import { pool } from "@/db/client";
import { writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const r = await pool.query(`SELECT * FROM shifts WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  await pool.query(`UPDATE shifts SET name=COALESCE($1,name), start_time=COALESCE($2,start_time), end_time=COALESCE($3,end_time), grace_minutes=COALESCE($4,grace_minutes) WHERE id=$5`,
    [body.name ?? null, body.start_time ?? null, body.end_time ?? null, body.grace_minutes ?? null, id]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Shift updated", targetType: "shift", targetId: id, detail: body.name || r.rows[0].name, at: new Date().toISOString() });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const r = await pool.query(`SELECT * FROM shifts WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  await pool.query(`DELETE FROM shifts WHERE id=$1`, [id]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Shift deleted", targetType: "shift", targetId: id, detail: r.rows[0].name, at: new Date().toISOString() });
  return Response.json({ ok: true });
}
