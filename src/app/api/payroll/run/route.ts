import { pool } from "@/db/client";
import { computePayslip } from "@/lib/payroll";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/state";

const HR_ROLES = ["hr_admin", "hr_manager", "super_admin"];

/** POST /api/payroll/run {period:"YYYY-MM"} — hitung draft payroll seluruh karyawan aktif. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) {
    return Response.json({ ok: false, error: "Hanya HR." }, { status: 403 });
  }
  const { period } = (await req.json()) as { period?: string };
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return Response.json({ ok: false, error: "Format periode YYYY-MM." }, { status: 400 });
  }

  const existing = await pool.query(`SELECT status FROM payroll_runs WHERE period = $1`, [period]);
  if (existing.rows[0]?.status === "approved") {
    return Response.json({ ok: false, error: "Payroll periode ini sudah di-approve & terkunci." }, { status: 409 });
  }

  const start = `${period}-01`;
  const endDate = new Date(`${start}T00:00:00`);
  endDate.setMonth(endDate.getMonth() + 1);
  const end = endDate.toISOString().slice(0, 10);

  const emps = await pool.query(
    `SELECT e.id, e.name, e.base_salary, e.allowance FROM employees e WHERE e.status <> 'resigned' ORDER BY e.id`,
  );

  const runId = `PR-${period}`;
  await pool.query(`DELETE FROM payslips WHERE run_id = $1`, [runId]);
  await pool.query(
    `INSERT INTO payroll_runs (id, period, status, created_at) VALUES ($1,$2,'draft',$3)
     ON CONFLICT (period) DO UPDATE SET created_at = $3, status = 'draft'`,
    [runId, period, new Date()],
  );

  let count = 0;
  for (const emp of emps.rows) {
    const schedR = await pool.query(
      `SELECT COUNT(*)::int AS c FROM roster WHERE employee_id=$1 AND date >= $2 AND date < $3 AND shift_id IS NOT NULL`,
      [emp.id, start, end],
    );
    const attR = await pool.query(
      `SELECT COUNT(*)::int AS c FROM attendance WHERE employee_id=$1 AND date >= $2 AND date < $3
       AND verification_status IN ('valid','review') AND status IN ('present','late','early_leave','wfh','business_trip')`,
      [emp.id, start, end],
    );
    const leaveR = await pool.query(
      `SELECT COALESCE(SUM(l.days),0)::int AS c FROM leave_requests l JOIN leave_types t ON t.id=l.type_id
       WHERE l.employee_id=$1 AND l.status='approved' AND t.paid=true AND l.start_date >= $2 AND l.start_date < $3`,
      [emp.id, start, end],
    );
    const otR = await pool.query(
      `SELECT COALESCE(SUM(hours),0)::float AS h FROM overtime_requests
       WHERE employee_id=$1 AND status='approved' AND date >= $2 AND date < $3`,
      [emp.id, start, end],
    );

    const breakdown = computePayslip({
      baseSalary: emp.base_salary,
      allowance: emp.allowance,
      scheduledDays: schedR.rows[0].c,
      presentDays: attR.rows[0].c,
      paidLeaveDays: leaveR.rows[0].c,
      overtimeHours: Number(otR.rows[0].h),
    });

    await pool.query(
      `INSERT INTO payslips (id, run_id, employee_id, breakdown) VALUES ($1,$2,$3,$4)
       ON CONFLICT (run_id, employee_id) DO UPDATE SET breakdown = $4`,
      [`${runId}-${emp.id}`, runId, emp.id, JSON.stringify(breakdown)],
    );
    count++;
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
