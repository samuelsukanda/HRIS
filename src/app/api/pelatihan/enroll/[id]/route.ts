import { pool } from "@/db/client";
import { writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const { id } = await params;
  const r = await pool.query(`SELECT * FROM training_enrollments WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });

  const enr = r.rows[0];
  if (enr.employee_id !== user.employee_id && !["hr", "super_admin"].includes(user.role)) {
    return Response.json({ ok: false }, { status: 403 });
  }

  await pool.query(`UPDATE training_enrollments SET status='cancelled' WHERE id=$1`, [id]);

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({
    actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id,
    action: "Training enrollment cancelled", targetType: "training_enrollment", targetId: id,
    detail: `Enrollment ${enr.training_id} cancelled`, at: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
