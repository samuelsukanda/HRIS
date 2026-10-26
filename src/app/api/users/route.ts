import { pool } from "@/db/client";
import { canManageAccount } from "@/lib/server/access";
import { nextId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";
import { hashPassword, randomPassword } from "@/lib/server/auth";
import type { Role } from "@/lib/types";

import { isHr } from "@/lib/roles";
const VALID_ROLES: Role[] = ["super_admin", "hr", "manager", "supervisor", "employee"];

// Buat akun login untuk karyawan yang belum punya akun
export async function POST(req: Request) {
  const u = await getSessionUser();
  if (!u) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(u.role)) return Response.json({ ok: false }, { status: 403 });

  const body = await req.json() as Record<string, unknown>;
  const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
  if (!employeeId) return Response.json({ ok: false, error: "Karyawan wajib dipilih." }, { status: 400 });

  const role = VALID_ROLES.includes(body.role as Role) ? (body.role as Role) : "employee";
  if (role === "super_admin" && u.role !== "super_admin") {
    return Response.json({ ok: false, error: "Hanya super_admin yang dapat membuat super_admin." }, { status: 403 });
  }

  const emp = await pool.query(`SELECT id, name, email, branch_id FROM employees WHERE id=$1`, [employeeId]);
  if (!emp.rows.length) return Response.json({ ok: false, error: "Karyawan tidak ditemukan." }, { status: 404 });
  if (!canManageAccount({ id: u.id, employeeId: u.employee_id, role: u.role as Role, branchId: u.branch_id }, { role, employeeId }, emp.rows[0].branch_id)) {
    return Response.json({ ok: false, error: "Karyawan berada di luar cabang Anda." }, { status: 403 });
  }
  const email = String(emp.rows[0].email ?? "").trim();
  if (!email) return Response.json({ ok: false, error: "Karyawan belum memiliki email — lengkapi data karyawan dahulu." }, { status: 400 });

  const dupEmp = await pool.query(`SELECT id FROM users WHERE employee_id=$1`, [employeeId]);
  if (dupEmp.rows.length) return Response.json({ ok: false, error: "Karyawan ini sudah memiliki akun." }, { status: 409 });
  const dupEmail = await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, [email]);
  if (dupEmail.rows.length) return Response.json({ ok: false, error: "Email sudah dipakai akun lain." }, { status: 409 });

  const password = randomPassword();
  const userId = await nextId("users", "USR");
  await pool.query(
    `INSERT INTO users (id, email, employee_id, role, password_hash) VALUES ($1,$2,$3,$4,$5)`,
    [userId, email, employeeId, role, hashPassword(password)],
  );

  const actor = u.name;
  await writeAudit({
    actorId: u.id, actorName: actor, action: "User created", targetType: "user", targetId: userId,
    detail: `${emp.rows[0].name} (${employeeId}) — ${role}`, at: new Date().toISOString(),
  });

  return Response.json({ ok: true, userId, email, tempPassword: password });
}
