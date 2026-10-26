import { pool } from "@/db/client";
import { canManageAccount } from "@/lib/server/access";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/state";
import type { Role } from "@/lib/types";

import { isHr } from "@/lib/roles";
const VALID_ROLES: Role[] = ["super_admin","hr","manager","supervisor","employee"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getSessionUser(); if (!u) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(u.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const r = await pool.query(
    `SELECT u.id, u.email, u.employee_id, u.role, u.active, e.branch_id
     FROM users u JOIN employees e ON e.id = u.employee_id WHERE u.id = $1`,
    [id],
  );
  if (!r.rows.length) return Response.json({ ok: false }, { status: 404 });
  const target = r.rows[0];
  if (!canManageAccount({ id: u.id, employeeId: u.employee_id, role: u.role as Role, branchId: u.branch_id }, { role: target.role, employeeId: target.employee_id }, target.branch_id)) {
    return Response.json({ ok: false, error: "Anda tidak berhak mengelola akun ini." }, { status: 403 });
  }
  return Response.json({ user: r.rows[0] });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getSessionUser(); if (!u) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(u.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;
  const r = await pool.query(
    `SELECT u.*, e.branch_id FROM users u JOIN employees e ON e.id = u.employee_id WHERE u.id = $1`,
    [id],
  );
  if (!r.rows.length) return Response.json({ ok: false }, { status: 404 });
  const target = r.rows[0];
  if (!canManageAccount({ id: u.id, employeeId: u.employee_id, role: u.role as Role, branchId: u.branch_id }, { role: target.role, employeeId: target.employee_id }, target.branch_id)) {
    return Response.json({ ok: false, error: "Anda tidak berhak mengelola akun ini." }, { status: 403 });
  }
  if ("role" in body && typeof body.role === "string") {
    if (id === u.id && body.role !== u.role) return Response.json({ ok: false, error: "Tidak dapat mengubah role akun sendiri." }, { status: 400 });
    if (!VALID_ROLES.includes(body.role as Role)) return Response.json({ ok: false, error: "Role tidak valid." }, { status: 400 });
    if (body.role === "super_admin" && u.role !== "super_admin") {
      return Response.json({ ok: false, error: "Hanya super_admin yang dapat memberi role super_admin." }, { status: 403 });
    }
    await pool.query(`UPDATE users SET role=$1, session_version=session_version+1 WHERE id=$2`, [body.role, id]);
  }
  if ("active" in body && typeof body.active === "boolean") {
    if (id === u.id && body.active === false) return Response.json({ ok: false, error: "Tidak dapat menonaktifkan akun sendiri." }, { status: 400 });
    await pool.query(`UPDATE users SET active=$1, session_version=session_version+1 WHERE id=$2`, [body.active, id]);
  }
  const actor = u.name;
  await writeAudit({ actorId: u.id, actorName: actor, action: "User updated", targetType: "user", targetId: id, detail: JSON.stringify(body), at: new Date().toISOString() });
  return Response.json({ ok: true });
}
