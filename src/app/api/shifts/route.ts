import { pool } from "@/db/client";
import { nextId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

import { isHr } from "@/lib/roles";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const r = await pool.query(`SELECT * FROM shifts ORDER BY name`);
  return Response.json({ shifts: r.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });
  const body = await req.json() as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const start = (typeof body.start === "string" && body.start) || (typeof body.start_time === "string" && (body.start_time as string)) || "";
  const end = (typeof body.end === "string" && body.end) || (typeof body.end_time === "string" && (body.end_time as string)) || "";
  const grace = Number(body.graceMinutes ?? body.grace_minutes) || 15;
  if (!name || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || grace < 0 || grace > 120) return Response.json({ ok: false, error: "Field shift tidak valid." }, { status: 400 });
  const crosses = typeof body.crossesMidnight === "boolean" ? body.crossesMidnight : end < start;
  const id = typeof body.id === "string" && body.id ? (body.id as string) : await nextId("shifts", "SFT");
  await pool.query(`INSERT INTO shifts (id,name,start_time,end_time,grace_minutes,crosses_midnight) VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, name, start, end, grace, crosses]);
  await writeAudit({ actorId: user.id, actorName: user.name, action: "Shift created", targetType: "shift", targetId: id, detail: name, at: new Date().toISOString() });
  return Response.json({ ok: true, id });
}
