import { pool } from "@/db/client";
import { nextId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const r = await pool.query(`SELECT * FROM trainings ORDER BY start_date DESC`);
  return Response.json({ pelatihan: r.rows, trainings: r.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });
  const body = await req.json() as Record<string,string>;
  const title = body.title ?? body.name;
  const provider = body.provider;
  const description = body.description;
  const start_date = body.start_date ?? body.startDate;
  const end_date = body.end_date ?? body.endDate;
  const max_participants = body.max_participants ?? body.maxParticipants ?? body.quota;
  const status = body.status;
  if (!title || !provider || !start_date) return Response.json({ ok: false, error: "Field wajib kosong." }, { status: 400 });
  const id = await nextId("trainings", "TRN");
  await pool.query(`INSERT INTO trainings (id,title,provider,description,start_date,end_date,max_participants,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, title, provider, description || "", start_date, end_date || start_date, Number(max_participants) || 20, status || "upcoming"]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Training created", targetType: "pelatihan", targetId: id, detail: title, at: new Date().toISOString() });
  return Response.json({ ok: true, id });
}
