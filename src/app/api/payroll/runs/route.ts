import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";

/** GET /api/payroll/runs — daftar run payroll (HR saja). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!["hr", "super_admin"].includes(user.role)) {
    return Response.json({ ok: false, error: "Hanya HR." }, { status: 403 });
  }
  const r = await pool.query(
    `SELECT p.*, COUNT(s.id)::int AS slips FROM payroll_runs p
     LEFT JOIN payslips s ON s.run_id = p.id
     GROUP BY p.id ORDER BY p.period DESC LIMIT 24`,
  );
  return Response.json({
    runs: r.rows.map((x) => ({
      id: x.id, period: x.period, status: x.status, createdAt: x.created_at,
      approvedAt: x.approved_at, approvedBy: x.approved_by, slips: x.slips,
    })),
  });
}
