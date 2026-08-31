import { pool } from "@/db/client";
import { writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const r = await pool.query(`SELECT * FROM roster ORDER BY date DESC`);
  return Response.json({ rosters: r.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });
  const body = await req.json();
  const { employee_id, shift_id, date, employeeId, shiftId } = body as Record<string,string>;
  const eid = employee_id ?? employeeId;
  const sid = shift_id ?? shiftId;
  if (!eid || !date) return Response.json({ ok: false, error: "Field wajib kosong." }, { status: 400 });
  await pool.query(`INSERT INTO roster (employee_id, date, shift_id) VALUES ($1,$2,$3) ON CONFLICT (employee_id, date) DO UPDATE SET shift_id=EXCLUDED.shift_id`, [eid, date, sid ?? null]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  const id = `${eid}-${date}`;
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Roster created", targetType: "roster", targetId: id, detail: `${eid} → ${sid ?? "Off"} @ ${date}`, at: new Date().toISOString() });
  return Response.json({ ok: true, id });
}
