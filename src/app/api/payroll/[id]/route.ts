import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/state";

const HR_ROLES = ["hr_admin", "hr_manager", "super_admin"];

/** GET /api/payroll/[id] — detail run + seluruh slip (HR saja). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false, error: "Hanya HR." }, { status: 403 });
  const { id } = await ctx.params;
  const runR = await pool.query(`SELECT * FROM payroll_runs WHERE id = $1`, [id]);
  const run = runR.rows[0];
  if (!run) return Response.json({ ok: false, error: "Run tidak ada." }, { status: 404 });
  const slipsR = await pool.query(
    `SELECT s.employee_id, e.name, e.position_id, d.name dept, s.breakdown
     FROM payslips s JOIN employees e ON e.id = s.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE s.run_id = $1 ORDER BY e.id`,
    [id],
  );
  return Response.json({
    run: { id: run.id, period: run.period, status: run.status, approvedAt: run.approved_at, approvedBy: run.approved_by },
    slips: slipsR.rows.map((x) => ({
      employeeId: x.employee_id, name: x.name, positionId: x.position_id, dept: x.dept,
      breakdown: x.breakdown,
    })),
  });
}

/** PATCH /api/payroll/[id] {approve:true} — kunci periode. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) {
    return Response.json({ ok: false, error: "Hanya HR." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const { approve } = (await req.json()) as { approve?: boolean };
  if (!approve) return Response.json({ ok: false, error: "Aksi tidak dikenal." }, { status: 400 });

  const runR = await pool.query(`SELECT * FROM payroll_runs WHERE id = $1`, [id]);
  const run = runR.rows[0];
  if (!run) return Response.json({ ok: false, error: "Run tidak ada." }, { status: 404 });
  if (run.status === "approved") return Response.json({ ok: false, error: "Sudah terkunci." }, { status: 409 });

  await pool.query(`UPDATE payroll_runs SET status='approved', approved_at=$1, approved_by=$2 WHERE id=$3`, [
    new Date(), user.name, id,
  ]);
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "Payroll approved",
    targetType: "payroll_run",
    targetId: id,
    detail: `Periode ${run.period} dikunci dan disetujui`,
    before: "draft",
    after: "approved",
    at: new Date().toISOString(),
  });
  return Response.json({ ok: true });
}
