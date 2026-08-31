import { pool } from "@/db/client";
import { setSessionCookie } from "@/lib/server/session";

/** Khusus development: deep-link ?as=USR-xxx tanpa password. */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ ok: false, error: "Dev-only" }, { status: 403 });
  }
  const { userId } = (await req.json()) as { userId?: string };
  if (!userId) return Response.json({ ok: false }, { status: 400 });
  const r = await pool.query(`SELECT id FROM users WHERE id = $1`, [userId]);
  if (!r.rows[0]) return Response.json({ ok: false }, { status: 404 });
  await setSessionCookie(userId);
  return Response.json({ ok: true });
}
