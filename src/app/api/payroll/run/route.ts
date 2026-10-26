import { pool } from "@/db/client";
import { computePayslip, type PayrollConfig } from "@/lib/payroll";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/state";

/** POST /api/payroll/run {period:"YYYY-MM"} — hitung draft payroll seluruh karyawan aktif. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (user.role !== "super_admin") {
    return Response.json({ ok: false, error: "Hanya super admin." }, { status: 403 });
  }
  const { period } = (await req.json()) as { period?: string };
  if (typeof period !== "string" || !/^\d{4}-\d{2}$/.test(period)) {
    return Response.json({ ok: false, error: "Format periode YYYY-MM." }, { status: 400 });
  }

  const [y, m] = period.split("-").map(Number);
  if (m < 1 || m > 12) {
    return Response.json({ ok: false, error: "Bulan periode harus antara 01 dan 12." }, { status: 400 });
  }
  const start = `${period}-01`;
  // batas eksklusif = tanggal 1 bulan berikut, dirakit lokal (tanpa toISOString yang menggeser hari di WIB)
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  const endEx = `${ny}-${String(nm).padStart(2, "0")}-01`;

  // Superadmin hanya akun pengaturan — tidak ikut payroll
  const emps = await pool.query(
    `SELECT e.id, e.name, e.nik, e.join_date, e.employment_type, e.bank_name, e.bank_account,
            e.base_salary, e.allowance, pos.title AS position_title, dep.name AS department_name
     FROM employees e
     LEFT JOIN positions pos ON pos.id = e.position_id
     LEFT JOIN departments dep ON dep.id = e.department_id
     WHERE e.status IN ('active','on_leave')
       AND NOT EXISTS (SELECT 1 FROM users u WHERE u.employee_id = e.id AND u.role = 'super_admin')
     ORDER BY e.id`,
  );

  const cfgR = await pool.query(`SELECT key, value FROM settings WHERE key IN ('ot_mode','ot_flat_rate','alpha_mode','alpha_flat_rate')`);
  const s = Object.fromEntries(cfgR.rows.map((r: { key: string; value: string }) => [r.key, r.value]));
  const cfg: PayrollConfig = {
    otMode: s.ot_mode === "flat" ? "flat" : "formula",
    otFlatRate: Number(s.ot_flat_rate) || 0,
    alphaMode: s.alpha_mode === "flat" ? "flat" : "proportional",
    alphaFlatRate: Number(s.alpha_flat_rate) || 0,
  };

  const runId = `PR-${period}`;
  const client = await pool.connect();
  let count = 0;
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [period]);
    const current = await client.query(`SELECT status FROM payroll_runs WHERE period = $1 FOR UPDATE`, [period]);
    if (current.rows[0]?.status === "approved") {
      await client.query("ROLLBACK");
      return Response.json({ ok: false, error: "Payroll periode ini sudah di-approve & terkunci." }, { status: 409 });
    }
    await client.query(`DELETE FROM payslips WHERE run_id = $1`, [runId]);
    await client.query(
      `INSERT INTO payroll_runs (id, period, status, created_at) VALUES ($1,$2,'draft',$3)
       ON CONFLICT (period) DO UPDATE SET created_at = $3, status = 'draft'`,
      [runId, period, new Date()],
    );

    for (const emp of emps.rows) {
      const schedR = await client.query(
        `SELECT COUNT(*)::int AS c FROM roster WHERE employee_id=$1 AND date >= $2 AND date < $3 AND shift_id IS NOT NULL`,
        [emp.id, start, endEx],
      );
      const attR = await client.query(
        `SELECT COUNT(*)::int AS c FROM attendance WHERE employee_id=$1 AND date >= $2 AND date < $3
         AND verification_status = 'valid' AND status IN ('present','late','early_leave','wfh','business_trip')`,
        [emp.id, start, endEx],
      );
      // cuti lintas bulan: hitung hari overlap dengan periode, bukan full l.days
      const leaveR = await client.query(
        `SELECT COALESCE(SUM(LEAST(l.end_date, ($3::date - INTERVAL '1 day')::date) - GREATEST(l.start_date, $2) + 1),0)::int AS c
         FROM leave_requests l JOIN leave_types t ON t.id=l.type_id
         WHERE l.employee_id=$1 AND l.status='approved' AND t.paid=true AND l.start_date < $3 AND l.end_date >= $2`,
        [emp.id, start, endEx],
      );
      const otR = await client.query(
        `SELECT COALESCE(SUM(hours),0)::float AS h FROM overtime_requests
         WHERE employee_id=$1 AND status='approved' AND date >= $2 AND date < $3`,
        [emp.id, start, endEx],
      );

      const breakdown = computePayslip({
        baseSalary: emp.base_salary,
        allowance: emp.allowance,
        scheduledDays: schedR.rows[0].c,
        presentDays: attR.rows[0].c,
        paidLeaveDays: leaveR.rows[0].c,
        overtimeHours: Number(otR.rows[0].h),
      }, cfg);

      await client.query(
        `INSERT INTO payslips (id, run_id, employee_id, breakdown, employee_snapshot) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (run_id, employee_id) DO UPDATE SET breakdown = EXCLUDED.breakdown, employee_snapshot = EXCLUDED.employee_snapshot`,
        [`${runId}-${emp.id}`, runId, emp.id, JSON.stringify(breakdown), JSON.stringify({
          nik: emp.nik,
          name: emp.name,
          joinDate: emp.join_date,
          employmentType: emp.employment_type,
          bankName: emp.bank_name,
          bankAccount: emp.bank_account,
          baseSalary: emp.base_salary,
          allowance: emp.allowance,
          position: emp.position_title,
          department: emp.department_name,
        })],
      );
      count++;
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "Payroll drafted",
    targetType: "payroll_run",
    targetId: runId,
    detail: `Periode ${period}: ${count} slip gaji dihitung`,
    at: new Date().toISOString(),
  });

  return Response.json({ ok: true, runId, period, employees: count });
}
