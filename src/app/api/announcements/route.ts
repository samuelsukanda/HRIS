import { pool } from "@/db/client";
import { nextId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

import { isHr } from "@/lib/roles";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const r = await pool.query(`SELECT * FROM announcements ORDER BY date DESC`);
  return Response.json({ announcements: r.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });

  const body = await req.json();
  const { title, body: content, category, date } = body as { title: string; body: string; category: string; date: string };
  if (!title || !content || !category) return Response.json({ ok: false, error: "Field wajib kosong." }, { status: 400 });

  const id = await nextId("announcements", "ANN");
  await pool.query(
    `INSERT INTO announcements (id,title,body,category,date) VALUES ($1,$2,$3,$4,$5)`,
    [id, title, content, category, date || new Date().toISOString().slice(0, 10)],
  );

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({
    actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id,
    action: "Announcement created", targetType: "announcement", targetId: id,
    detail: title, at: new Date().toISOString(),
  });

  return Response.json({ ok: true, id });
}
