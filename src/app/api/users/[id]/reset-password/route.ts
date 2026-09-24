import { pool } from "@/db/client";
import { writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";
import { hashPassword, randomPassword } from "@/lib/server/auth";

import { isHr } from "@/lib/roles";

// Reset password akun oleh admin — password baru acak, tampil sekali
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getSessionUser();
  if (!u) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(u.role)) return Response.json({ ok: false }, { status: 403 });

  const { id } = await params;
  const r = await pool.query(`SELECT id, email FROM users WHERE id=$1`, [id]);
  if (!r.rows.length) return Response.json({ ok: false, error: "Akun tidak ditemukan." }, { status: 404 });

  const password = randomPassword();
  await pool.query(`UPDATE users SET password_hash=$1 WHERE id=$2`, [hashPassword(password), id]);

  const actor = (await pool.query(`SELECT name FROM employees WHERE id=$1`, [u.employee_id])).rows[0]?.name ?? u.employee_id;
  await writeAudit({
    actorId: u.id, actorName: actor, action: "Password reset", targetType: "user", targetId: id,
    detail: r.rows[0].email, at: new Date().toISOString(),
  });

  return Response.json({ ok: true, tempPassword: password });
}
