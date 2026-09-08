import { pool } from "@/db/client";
import { verifyPassword } from "@/lib/server/auth";
import { setSessionCookie } from "@/lib/server/session";

export async function POST(req: Request) {
  const { email, password } = (await req.json()) as { email?: string; password?: string };
  if (!email || !password) {
    return Response.json({ ok: false, error: "Email dan password wajib diisi." }, { status: 400 });
  }
  const r = await pool.query(
    `SELECT u.id, u.password_hash, u.active FROM users u WHERE lower(u.email) = lower($1)`,
    [email.trim()],
  );
  const user = r.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    return Response.json({ ok: false, error: "Email atau password salah." }, { status: 401 });
  }
  if (user.active === false) {
    return Response.json({ ok: false, error: "Akun dinonaktifkan. Hubungi HR." }, { status: 403 });
  }
  await setSessionCookie(user.id);
  return Response.json({ ok: true });
}
