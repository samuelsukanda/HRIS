import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { nextId, writeAudit } from "@/lib/server/state";
import { isHr } from "@/lib/roles";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const result = await pool.query(`SELECT * FROM leave_types ORDER BY id`);
  return Response.json({ leave_types: result.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !isHr(user.role)) return Response.json({ ok: false }, { status: 403 });
  const body = await req.json() as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return Response.json({ ok: false, error: "Field wajib" }, { status: 400 });
  const id = await nextId("leave_types", "LV");
  await pool.query(`INSERT INTO leave_types (id,name,allocation_days,paid,requires_attachment) VALUES ($1,$2,$3,$4,$5)`, [id, name, Number(body.allocation_days) || 12, Boolean(body.paid), Boolean(body.requires_attachment)]);
  const actor = user.name;
  await writeAudit({ actorId: user.id, actorName: actor, action: "LeaveType created", targetType: "leave_type", targetId: id, detail: name, at: new Date().toISOString() });
  return Response.json({ ok: true, id });
}
