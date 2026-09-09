import { cookies } from "next/headers";
import { pool } from "@/db/client";
import { readSessionToken } from "@/lib/server/auth";

/** GET /api/auth/status — bedakan sesi kedaluwarsa vs akun dinonaktifkan. */
export async function GET() {
  const token = (await cookies()).get("hris_session")?.value;
  const parsed = readSessionToken(token);
  if (!parsed) return Response.json({ ok: false, code: "no_session" }, { status: 401 });
  const r = await pool.query(`SELECT active FROM users WHERE id=$1`, [parsed.userId]);
  if (r.rows.length === 0) return Response.json({ ok: false, code: "no_session" }, { status: 401 });
  if (r.rows[0].active === false) return Response.json({ ok: false, code: "disabled" }, { status: 403 });
  return Response.json({ ok: true });
}
