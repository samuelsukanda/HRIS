import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { nextId, writeAudit } from "@/lib/server/state";

/** POST /api/overtime — ajukan lembur */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const b = (await req.json()) as { date: string; start: string; end: string; hours: number; reason: string };
  if (!b.date || !b.start || !b.end || !b.reason?.trim() || !b.hours) {
    return Response.json({ ok: false, error: "Lengkapi formulir." }, { status: 400 });
  }
  const id = await nextId("overtime_requests", "OTR");
  await pool.query(
    `INSERT INTO overtime_requests (id,employee_id,date,start_time,end_time,hours,reason,status,submitted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8)`,
    [id, user.employee_id, b.date, b.start, b.end, b.hours, b.reason.trim(), new Date()],
  );
  const nameR = await pool.query(`SELECT name FROM employees WHERE id = $1`, [user.employee_id]);
  await writeAudit({
    actorId: user.id, actorName: nameR.rows[0]?.name ?? "-",
    action: "Overtime requested", targetType: "overtime_request", targetId: id,
    detail: `${b.date} ${b.start}–${b.end} (${b.hours} jam)`, at: new Date().toISOString(),
  });
  return Response.json({ ok: true, id });
}
