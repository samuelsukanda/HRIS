import { pool } from "@/db/client";
import { writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { title, body: content, category, date } = body as { title?: string; body?: string; category?: string; date?: string };

  const r = await pool.query(`SELECT * FROM announcements WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });

  await pool.query(
    `UPDATE announcements SET title=COALESCE($1,title), body=COALESCE($2,body), category=COALESCE($3,category), date=COALESCE($4,date) WHERE id=$5`,
    [title ?? null, content ?? null, category ?? null, date ?? null, id],
  );

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({
    actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id,
    action: "Announcement updated", targetType: "announcement", targetId: id,
    detail: title ?? r.rows[0].title, at: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });

  const { id } = await params;
  const r = await pool.query(`SELECT * FROM announcements WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });

  await pool.query(`DELETE FROM announcements WHERE id=$1`, [id]);

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({
    actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id,
    action: "Announcement deleted", targetType: "announcement", targetId: id,
    detail: r.rows[0].title, at: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
