import { pool } from "@/db/client";
import { nextId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const r = await pool.query(`SELECT * FROM work_locations ORDER BY name`);
  return Response.json({ locations: r.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });

  const body = await req.json();
  const { name, latitude, longitude, radius_m, address } = body;
  if (!name || !latitude || !longitude) return Response.json({ ok: false, error: "Field wajib kosong." }, { status: 400 });

  const id = await nextId("work_locations", "LOC");
  await pool.query(
    `INSERT INTO work_locations (id,name,latitude,longitude,radius_m,address) VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, name, latitude, longitude, radius_m || 200, address || null],
  );

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Location created", targetType: "location", targetId: id, detail: name, at: new Date().toISOString() });

  return Response.json({ ok: true, id });
}
