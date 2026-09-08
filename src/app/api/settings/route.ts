import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/state";

const HR = ["hr_manager","hr_admin","super_admin"];

export async function GET() {
  const u = await getSessionUser(); if (!u) return Response.json({ ok: false }, { status: 401 });
  const r = await pool.query(`SELECT * FROM settings`);
  return Response.json({ settings: Object.fromEntries(r.rows.map((x: { key: string; value: string }) => [x.key, x.value])) });
}

export async function PATCH(req: Request) {
  const u = await getSessionUser(); if (!u) return Response.json({ ok: false }, { status: 401 });
  if (!HR.includes(u.role)) return Response.json({ ok: false }, { status: 403 });
  const body = await req.json() as Record<string, string>;
  const actor = (await pool.query(`SELECT name FROM employees WHERE id=$1`, [u.employee_id])).rows[0]?.name ?? u.employee_id;
  for (const [key, value] of Object.entries(body)) {
    await pool.query(`INSERT INTO settings (key,value,updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`, [key, value]);
    await writeAudit({ actorId: u.id, actorName: actor, action: "Setting updated", targetType: "setting", targetId: key, detail: `${key}=${value}`, at: new Date().toISOString() });
  }
  return Response.json({ ok: true });
}
