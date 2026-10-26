import { pool } from "@/db/client";
import { canManageEmployee } from "@/lib/server/access";
import { writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";
import type { Role } from "@/lib/types";

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
  const targetR = await pool.query(
    `SELECT e.id, e.branch_id AS "branchId", e.spv_id AS "spvId", e.manager_id AS "managerId",
     EXISTS (SELECT 1 FROM users u WHERE u.employee_id=e.id AND u.role='super_admin') AS "isSuperAdmin"
     FROM employees e WHERE e.id=$1`,
    [p.eid],
  );
  if (!targetR.rows.length) return Response.json({ ok: false, error: "Karyawan tidak ditemukan." }, { status: 404 });
  if (!canManageEmployee({ id: user.id, employeeId: user.employee_id, role: user.role as Role, branchId: user.branch_id }, targetR.rows[0])) {
    return Response.json({ ok: false, error: "Karyawan berada di luar cakupan Anda." }, { status: 403 });
  }
  const sid = body.shift_id ?? body.shiftId ?? null;
  await pool.query(`UPDATE roster SET shift_id=$1 WHERE employee_id=$2 AND date=$3`, [sid, p.eid, p.date]);
  await writeAudit({ actorId: user.id, actorName: user.name, action: "Roster updated", targetType: "roster", targetId: id, detail: p.eid, at: new Date().toISOString() });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const p = parseId(id);
  if (!p) return Response.json({ ok: false, error: "ID roster tidak valid." }, { status: 400 });
  const targetR = await pool.query(
    `SELECT e.id, e.branch_id AS "branchId", e.spv_id AS "spvId", e.manager_id AS "managerId",
     EXISTS (SELECT 1 FROM users u WHERE u.employee_id=e.id AND u.role='super_admin') AS "isSuperAdmin"
     FROM employees e WHERE e.id=$1`,
    [p.eid],
  );
  if (!targetR.rows.length) return Response.json({ ok: false, error: "Karyawan tidak ditemukan." }, { status: 404 });
  if (!canManageEmployee({ id: user.id, employeeId: user.employee_id, role: user.role as Role, branchId: user.branch_id }, targetR.rows[0])) {
    return Response.json({ ok: false, error: "Karyawan berada di luar cakupan Anda." }, { status: 403 });
  }
  await pool.query(`DELETE FROM roster WHERE employee_id=$1 AND date=$2`, [p.eid, p.date]);
  await writeAudit({ actorId: user.id, actorName: user.name, action: "Roster deleted", targetType: "roster", targetId: id, detail: p?.eid ?? id, at: new Date().toISOString() });
  return Response.json({ ok: true });
}
