import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/state";
import { scrypt } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const { currentPassword, newPassword } = (await req.json()) as { currentPassword: string; newPassword: string };
  if (!currentPassword || !newPassword) return Response.json({ ok: false, error: "Password wajib diisi." }, { status: 400 });
  if (newPassword.length < 8) return Response.json({ ok: false, error: "Password baru minimal 8 karakter." }, { status: 400 });

  const r = await pool.query(`SELECT password_hash, salt FROM users WHERE id = $1`, [user.id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });

  const { password_hash, salt } = r.rows[0];
  const checkHash = (await scryptAsync(currentPassword + salt, "hris-salt", 64)) as Buffer;
  if (checkHash.toString("hex") !== password_hash) {
    return Response.json({ ok: false, error: "Password lama salah." }, { status: 403 });
  }

  const newSalt = Math.random().toString(36).slice(2, 10);
  const newHash = (await scryptAsync(newPassword + newSalt, "hris-salt", 64)) as Buffer;
  await pool.query(`UPDATE users SET password_hash = $1, salt = $2 WHERE id = $3`, [newHash.toString("hex"), newSalt, user.id]);

  await writeAudit({
    actorId: user.id, actorName: user.name,
    action: "Password changed", targetType: "user", targetId: user.id,
    detail: "Password berhasil diubah", at: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
