import { pool } from "@/db/client";
import { creatorBranchId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

import { isHr } from "@/lib/roles";

/** HR non-super hanya boleh sentuh konten cabangnya sendiri (branch null = milik super_admin). */
async function assertBranchAccess(user: { role: string; employee_id: string }, rowBranch: string | null) {
  if (user.role === "super_admin") return null;
  const mine = await creatorBranchId(user.employee_id);
  if (rowBranch && mine && rowBranch !== mine) {
    return Response.json({ ok: false, error: "Pengumuman milik cabang lain." }, { status: 403 });
  }
  if (!rowBranch && user.role === "hr") {
    return Response.json({ ok: false, error: "Pengumuman perusahaan hanya bisa diubah super admin." }, { status: 403 });
  }
  return null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { title, body: content, category, date } = body as { title?: string; body?: string; category?: string; date?: string };

  const r = await pool.query(`SELECT * FROM announcements WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  const denied = await assertBranchAccess(user, r.rows[0].branch_id ?? null);
  if (denied) return denied;

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
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });

  const { id } = await params;
  const r = await pool.query(`SELECT * FROM announcements WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  const denied = await assertBranchAccess(user, r.rows[0].branch_id ?? null);
  if (denied) return denied;

  await pool.query(`DELETE FROM announcements WHERE id=$1`, [id]);

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({
    actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id,
    action: "Announcement deleted", targetType: "announcement", targetId: id,
    detail: r.rows[0].title, at: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
