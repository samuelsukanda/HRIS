import { pool } from "@/db/client";
import { nextId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const r = await pool.query(`SELECT * FROM shifts ORDER BY name`);
  return Response.json({ shifts: r.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });
  const body = await req.json();
  const { name, start_time, end_time, grace_minutes } = body;
  if (!name || !start_time || !end_time) return Response.json({ ok: false, error: "Field wajib kosong." }, { status: 400 });
  const id = await nextId("shifts", "SFT");
  await pool.query(`INSERT INTO shifts (id,name,start_time,end_time,grace_minutes) VALUES ($1,$2,$3,$4,$5)`,
    [id, name, start_time, end_time, grace_minutes || 15]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Shift created", targetType: "shift", targetId: id, detail: name, at: new Date().toISOString() });
  return Response.json({ ok: true, id });
}
