import { pool } from "@/db/client";
import { isActiveEmployeeStatus } from "@/lib/server/access";
import { verifyPassword } from "@/lib/server/auth";
import { setSessionCookie } from "@/lib/server/session";

export async function POST(req: Request) {
  const { email, password } = (await req.json()) as { email?: string; password?: string };
  if (!email || !password) {
    return Response.json({ ok: false, error: "Email dan password wajib diisi." }, { status: 400 });
  }
  const r = await pool.query(
    `SELECT u.id, u.password_hash, u.active, u.role, e.status
     FROM users u JOIN employees e ON e.id = u.employee_id
     WHERE lower(u.email) = lower($1)`,
    [email.trim()],
  );
  const user = r.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    return Response.json({ ok: false, error: "Email atau password salah." }, { status: 401 });
  }
  const validRoles = new Set(["super_admin", "hr", "manager", "supervisor", "employee"]);
  if (user.active === false || !validRoles.has(user.role) || !isActiveEmployeeStatus(user.status)) {
    return Response.json({ ok: false, error: "Akun dinonaktifkan. Hubungi HR." }, { status: 403 });
  }
  await setSessionCookie(user.id);
  return Response.json({ ok: true });
}
