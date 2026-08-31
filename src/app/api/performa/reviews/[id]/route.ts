import { pool } from "@/db/client";
import { writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });

  const { id } = await params;
  const r = await pool.query(`SELECT * FROM performance_reviews WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });

  await pool.query(`UPDATE performance_reviews SET status='final' WHERE id=$1`, [id]);

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({
    actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id,
    action: "Performance review finalized", targetType: "performance_review", targetId: id,
    detail: `Review ${r.rows[0].period} finalized`, after: "final", at: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
