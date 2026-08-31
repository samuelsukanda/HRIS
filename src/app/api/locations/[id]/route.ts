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
  const r = await pool.query(`SELECT * FROM work_locations WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  await pool.query(`UPDATE work_locations SET name=COALESCE($1,name), latitude=COALESCE($2,latitude), longitude=COALESCE($3,longitude), radius_m=COALESCE($4,radius_m), address=COALESCE($5,address) WHERE id=$6`,
    [body.name ?? null, body.latitude ?? null, body.longitude ?? null, body.radius_m ?? null, body.address ?? null, id]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Location updated", targetType: "location", targetId: id, detail: body.name || r.rows[0].name, at: new Date().toISOString() });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const r = await pool.query(`SELECT * FROM work_locations WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  await pool.query(`DELETE FROM work_locations WHERE id=$1`, [id]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Location deleted", targetType: "location", targetId: id, detail: r.rows[0].name, at: new Date().toISOString() });
  return Response.json({ ok: true });
}
