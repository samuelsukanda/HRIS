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

  const body = await req.json() as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const latitude = typeof body.latitude === "number" ? body.latitude : Number(body.latitude);
  const longitude = typeof body.longitude === "number" ? body.longitude : Number(body.longitude);
  const radiusM = typeof body.radiusM === "number" ? body.radiusM : typeof body.radius_m === "number" ? (body.radius_m as number) : 200;
  const branchId = (typeof body.branchId === "string" && body.branchId) || (typeof body.branch_id === "string" && (body.branch_id as string)) || "BR-JKT";
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return Response.json({ ok: false, error: "Field wajib kosong." }, { status: 400 });
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return Response.json({ ok: false, error: "Koordinat tidak valid." }, { status: 400 });

  const id = await nextId("work_locations", "LOC");
  await pool.query(
    `INSERT INTO work_locations (id,name,branch_id,latitude,longitude,radius_m,allowed_types) VALUES ($1,$2,$3,$4,$5,$6,'{onsite}')`,
    [id, name, branchId, latitude, longitude, radiusM || 200],
  );

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Location created", targetType: "location", targetId: id, detail: name, at: new Date().toISOString() });

  return Response.json({ ok: true, id });
}
