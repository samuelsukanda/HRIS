import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const r = await pool.query(`SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC`, [user.id]);
  return Response.json({ notifications: r.rows });
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const body = await req.json() as { markAll?: boolean; id?: string };
  if (body.markAll) {
    // super admin melihat SEMUA notifikasi perusahaan → tandai semua, bukan hanya miliknya
    if (user.role === "super_admin") {
      await pool.query(`UPDATE notifications SET read=true`);
    } else {
      await pool.query(`UPDATE notifications SET read=true WHERE user_id=$1`, [user.id]);
    }
  } else if (body.id) {
    await pool.query(`UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2`, [body.id, user.id]);
  }
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const body = await req.json() as { id?: string; all?: boolean };
  if (body.all) {
    await pool.query(`DELETE FROM notifications WHERE user_id=$1`, [user.id]);
  } else if (body.id) {
    await pool.query(`DELETE FROM notifications WHERE id=$1 AND user_id=$2`, [body.id, user.id]);
  } else {
    return Response.json({ ok: false, error: "Parameter tidak valid." }, { status: 400 });
  }
  return Response.json({ ok: true });
}
