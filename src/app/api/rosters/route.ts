import { pool } from "@/db/client";
import { canManageEmployee } from "@/lib/server/access";
import { writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";
import type { Role } from "@/lib/types";

import { isHr } from "@/lib/roles";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const r = user.role === "super_admin"
    ? await pool.query(`SELECT * FROM roster ORDER BY date DESC`)
    : user.role === "hr"
      ? await pool.query(`SELECT r.* FROM roster r JOIN employees e ON e.id=r.employee_id WHERE e.branch_id=$1 ORDER BY r.date DESC`, [user.branch_id])
      : user.role === "manager" || user.role === "supervisor"
        ? await pool.query(`SELECT r.* FROM roster r JOIN employees e ON e.id=r.employee_id WHERE e.id=$1 OR e.spv_id=$1 OR e.manager_id=$1 ORDER BY r.date DESC`, [user.employee_id])
        : await pool.query(`SELECT * FROM roster WHERE employee_id=$1 ORDER BY date DESC`, [user.employee_id]);
  return Response.json({ rosters: r.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });
  const body = await req.json();
  const { employee_id, shift_id, date, employeeId, shiftId } = body as Record<string,string>;
  const eid = employee_id ?? employeeId;
  const sid = shift_id ?? shiftId;
  if (!eid || !date) return Response.json({ ok: false, error: "Field wajib kosong." }, { status: 400 });
  const targetR = await pool.query(
    `SELECT e.id, e.branch_id AS "branchId", e.spv_id AS "spvId", e.manager_id AS "managerId",
     EXISTS (SELECT 1 FROM users u WHERE u.employee_id=e.id AND u.role='super_admin') AS "isSuperAdmin"
     FROM employees e WHERE e.id=$1`,
    [eid],
  );
  if (!targetR.rows.length) return Response.json({ ok: false, error: "Karyawan tidak ditemukan." }, { status: 404 });
  if (!canManageEmployee({ id: user.id, employeeId: user.employee_id, role: user.role as Role, branchId: user.branch_id }, targetR.rows[0])) {
    return Response.json({ ok: false, error: "Karyawan berada di luar cakupan Anda." }, { status: 403 });
  }
  await pool.query(`INSERT INTO roster (employee_id, date, shift_id) VALUES ($1,$2,$3) ON CONFLICT (employee_id, date) DO UPDATE SET shift_id=EXCLUDED.shift_id`, [eid, date, sid ?? null]);
  const id = `${eid}-${date}`;
  await writeAudit({ actorId: user.id, actorName: user.name, action: "Roster created", targetType: "roster", targetId: id, detail: `${eid} → ${sid ?? "Off"} @ ${date}`, at: new Date().toISOString() });
  return Response.json({ ok: true, id });
}
