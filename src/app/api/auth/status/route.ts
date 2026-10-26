import { cookies } from "next/headers";
import { pool } from "@/db/client";
import { isActiveEmployeeStatus } from "@/lib/server/access";
import { COOKIE_NAME, readSessionToken } from "@/lib/server/auth";

/** GET /api/auth/status — bedakan sesi kedaluwarsa vs akun dinonaktifkan. */
export async function GET() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const parsed = readSessionToken(token);
  if (!parsed) return Response.json({ ok: false, code: "no_session" }, { status: 401 });
  const r = await pool.query(
    `SELECT u.active, u.session_version, e.status FROM users u JOIN employees e ON e.id=u.employee_id
     WHERE u.id=$1 AND u.session_version=$2`,
    [parsed.userId, parsed.sessionVersion],
  );
  if (r.rows.length === 0) return Response.json({ ok: false, code: "no_session" }, { status: 401 });
  if (r.rows[0].active === false || !isActiveEmployeeStatus(r.rows[0].status)) return Response.json({ ok: false, code: "disabled" }, { status: 403 });
  return Response.json({ ok: true });
}
