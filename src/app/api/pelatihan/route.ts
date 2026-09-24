import { pool } from "@/db/client";
import { creatorBranchId, nextId, notifySameBranch, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

import { isHr } from "@/lib/roles";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const branchId = user.role === "super_admin" ? null : await creatorBranchId(user.employee_id);
  const r = branchId
    ? await pool.query(`SELECT * FROM trainings WHERE branch_id IS NULL OR branch_id=$1 ORDER BY start_date DESC`, [branchId])
    : await pool.query(`SELECT * FROM trainings ORDER BY start_date DESC`);
  return Response.json({ pelatihan: r.rows, trainings: r.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });
  const body = await req.json() as Record<string,string>;
  const title = body.title ?? body.name;
  const provider = body.provider;
  const description = body.description;
  const start_date = body.start_date ?? body.startDate;
  const end_date = body.end_date ?? body.endDate;
  const max_participants = body.max_participants ?? body.maxParticipants ?? body.quota;
  const status = body.status;
  if (!title || !provider || !start_date) return Response.json({ ok: false, error: "Field wajib kosong." }, { status: 400 });
  const branchId = user.role === "super_admin" ? null : await creatorBranchId(user.employee_id);
  const id = await nextId("trainings", "TRN");
  await pool.query(`INSERT INTO trainings (id,title,provider,description,start_date,end_date,max_participants,status,branch_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, title, provider, description || "", start_date, end_date || start_date, Number(max_participants) || 20, status || "upcoming", branchId]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  const actorName = empR.rows[0]?.name ?? user.employee_id;
  await writeAudit({ actorId: user.id, actorName, action: "Training created", targetType: "pelatihan", targetId: id, detail: title, at: new Date().toISOString() });
  await notifySameBranch(branchId, user.id, {
    title: "Pelatihan Baru",
    body: `${actorName} menambahkan pelatihan: ${title}`,
    type: "info",
    link: "/app/pelatihan",
  });
  return Response.json({ ok: true, id });
}
