import { pool } from "@/db/client";
import { writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const body = await req.json() as Record<string,any>;
  const r = await pool.query(`SELECT * FROM trainings WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  const title = body.title ?? body.name;
  const maxP = body.max_participants ?? body.maxParticipants ?? body.quota;
  await pool.query(`UPDATE trainings SET title=COALESCE($1,title), provider=COALESCE($2,provider), description=COALESCE($3,description), start_date=COALESCE($4,start_date), end_date=COALESCE($5,end_date), max_participants=COALESCE($6,max_participants), status=COALESCE($7,status) WHERE id=$8`,
    [title ?? null, body.provider ?? null, body.description ?? null, body.start_date ?? body.startDate ?? null, body.end_date ?? body.endDate ?? null, maxP ?? null, body.status ?? null, id]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Training updated", targetType: "pelatihan", targetId: id, detail: title || r.rows[0].title, at: new Date().toISOString() });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const r = await pool.query(`SELECT * FROM trainings WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  await pool.query(`DELETE FROM trainings WHERE id=$1`, [id]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Training deleted", targetType: "pelatihan", targetId: id, detail: r.rows[0]?.title ?? id, at: new Date().toISOString() });
  return Response.json({ ok: true });
}
