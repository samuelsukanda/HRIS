import { pool } from "@/db/client";
import { writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;
  const r = await pool.query(`SELECT * FROM work_locations WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const name = str(body.name);
  const latitude = num(body.latitude);
  const longitude = num(body.longitude);
  const radiusM = num(body.radiusM) ?? num(body.radius_m);
  const branchId = str(body.branchId) ?? str(body.branch_id);
  if (radiusM !== null && (radiusM < 1 || radiusM > 5000)) return Response.json({ ok: false, error: "Radius 1–5000 m." }, { status: 400 });
  if ((latitude !== null && (latitude < -90 || latitude > 90)) || (longitude !== null && (longitude < -180 || longitude > 180))) {
    return Response.json({ ok: false, error: "Koordinat tidak valid." }, { status: 400 });
  }
  await pool.query(`UPDATE work_locations SET name=COALESCE($1,name), latitude=COALESCE($2,latitude), longitude=COALESCE($3,longitude), radius_m=COALESCE($4,radius_m), branch_id=COALESCE($5,branch_id) WHERE id=$6`,
    [name, latitude, longitude, radiusM, branchId, id]);
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
