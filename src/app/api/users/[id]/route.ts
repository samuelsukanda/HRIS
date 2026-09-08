import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/state";

const HR = ["hr_manager","hr_admin","super_admin"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getSessionUser(); if (!u) return Response.json({ ok: false }, { status: 401 });
  if (!HR.includes(u.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;
  const r = await pool.query(`SELECT * FROM users WHERE id=$1`, [id]);
  if (!r.rows.length) return Response.json({ ok: false }, { status: 404 });
  if ("role" in body && typeof body.role === "string") {
    await pool.query(`UPDATE users SET role=$1 WHERE id=$2`, [body.role, id]);
  }
  if ("active" in body && typeof body.active === "boolean") {
    await pool.query(`UPDATE users SET active=$1 WHERE id=$2`, [body.active, id]);
  }
  const actor = (await pool.query(`SELECT name FROM employees WHERE id=$1`, [u.employee_id])).rows[0]?.name ?? u.employee_id;
  await writeAudit({ actorId: u.id, actorName: actor, action: "User updated", targetType: "user", targetId: id, detail: JSON.stringify(body), at: new Date().toISOString() });
  return Response.json({ ok: true });
}
