import { pool } from "@/db/client";
import { creatorBranchId, nextId, notifySameBranch, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

import { isHr } from "@/lib/roles";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const branchId = user.role === "super_admin" ? null : await creatorBranchId(user.employee_id);
  const r = branchId
    ? await pool.query(`SELECT * FROM announcements WHERE branch_id IS NULL OR branch_id=$1 ORDER BY date DESC`, [branchId])
    : await pool.query(`SELECT * FROM announcements ORDER BY date DESC`);
  return Response.json({ announcements: r.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });

  const body = await req.json();
  const { title, body: content, category, date } = body as { title: string; body: string; category: string; date: string };
  if (!title || !content || !category) return Response.json({ ok: false, error: "Field wajib kosong." }, { status: 400 });

  // super_admin → seluruh perusahaan (branch null); HR → cabang pembuat
  const branchId = user.role === "super_admin" ? null : await creatorBranchId(user.employee_id);
  const id = await nextId("announcements", "ANN");
  await pool.query(
    `INSERT INTO announcements (id,title,body,category,date,branch_id) VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, title, content, category, date || new Date().toISOString().slice(0, 10), branchId],
  );

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  const actorName = empR.rows[0]?.name ?? user.employee_id;
  await writeAudit({
    actorId: user.id, actorName,
    action: "Announcement created", targetType: "announcement", targetId: id,
    detail: title, at: new Date().toISOString(),
  });
  await notifySameBranch(branchId, user.id, {
    title: "Pengumuman Baru",
    body: `${actorName} menerbitkan pengumuman: ${title}`,
    type: "info",
    link: "/app/pengumuman",
  });

  return Response.json({ ok: true, id });
}
