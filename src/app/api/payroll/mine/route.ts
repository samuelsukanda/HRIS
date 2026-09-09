import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";

/** GET /api/payroll/mine — slip gaji milik sesi aktif (karyawan). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const [runs, identity] = await Promise.all([
    pool.query(
      `SELECT p.period, p.status, p.approved_at, s.breakdown
       FROM payslips s JOIN payroll_runs p ON p.id = s.run_id
       WHERE s.employee_id = $1 AND p.status = 'approved'
       ORDER BY p.period DESC LIMIT 12`,
      [user.employee_id],
    ),
    pool.query(
      `SELECT e.nik, e.name, e.join_date, e.employment_type, e.bank_name, e.bank_account,
              e.base_salary, e.allowance,
              pos.title AS position_title, dep.name AS department_name
       FROM employees e
       JOIN departments dep ON dep.id = e.department_id
       JOIN positions pos ON pos.id = e.position_id
       WHERE e.id = $1`,
      [user.employee_id],
    ),
  ]);
  const e = identity.rows[0];
  return Response.json({
    employee: e
      ? {
          nik: e.nik,
          name: e.name,
          joinDate: e.join_date,
          employmentType: e.employment_type,
          bankName: e.bank_name,
          bankAccount: e.bank_account,
          baseSalary: e.base_salary,
          allowance: e.allowance,
          position: e.position_title,
          department: e.department_name,
        }
      : null,
    slips: runs.rows.map((x) => ({
      period: x.period,
      approvedAt: x.approved_at,
      breakdown: x.breakdown,
    })),
  });
}
