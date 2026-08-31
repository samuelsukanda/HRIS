import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";

/** GET /api/payroll/mine — slip gaji milik sesi aktif (karyawan). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const r = await pool.query(
    `SELECT p.period, p.status, p.approved_at, s.breakdown
     FROM payslips s JOIN payroll_runs p ON p.id = s.run_id
     WHERE s.employee_id = $1 AND p.status = 'approved'
     ORDER BY p.period DESC LIMIT 12`,
    [user.employee_id],
  );
  return Response.json({
    slips: r.rows.map((x) => ({
      period: x.period,
      approvedAt: x.approved_at,
      breakdown: x.breakdown,
    })),
  });
}
