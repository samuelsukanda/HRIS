import { pool } from "@/db/client";
import { writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

import { isHr } from "@/lib/roles";
function parseId(id: string): { eid: string; date: string } | null {
  // id format EMP-001-2024-01-15  -> split last 3 parts as date
  const m = id.match(/^(.*)-(\d{4}-\d{2}-\d{2})$/);
  if (!m) return null;
  return { eid: m[1], date: m[2] };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const body = await req.json() as Record<string,string>;
  const p = parseId(id);
  if (!p) return Response.json({ ok: false, error: "ID roster tidak valid." }, { status: 400 });
  const sid = body.shift_id ?? body.shiftId ?? null;
  await pool.query(`UPDATE roster SET shift_id=$1 WHERE employee_id=$2 AND date=$3`, [sid, p.eid, p.date]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Roster updated", targetType: "roster", targetId: id, detail: p.eid, at: new Date().toISOString() });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const p = parseId(id);
  if (!p) return Response.json({ ok: false, error: "ID roster tidak valid." }, { status: 400 });
  await pool.query(`DELETE FROM roster WHERE employee_id=$1 AND date=$2`, [p.eid, p.date]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Roster deleted", targetType: "roster", targetId: id, detail: p?.eid ?? id, at: new Date().toISOString() });
  return Response.json({ ok: true });
}
