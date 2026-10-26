import { pool } from "@/db/client";
import { canManageAccount } from "@/lib/server/access";
import { writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";
import { hashPassword, randomPassword } from "@/lib/server/auth";

import { isHr } from "@/lib/roles";

// Reset password akun oleh admin — password baru acak, tampil sekali
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getSessionUser();
  if (!u) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(u.role)) return Response.json({ ok: false }, { status: 403 });

  const { id } = await params;
  const r = await pool.query(
    `SELECT u.id, u.email, u.employee_id, u.role, e.branch_id
     FROM users u JOIN employees e ON e.id = u.employee_id WHERE u.id = $1`,
    [id],
  );
  if (!r.rows.length) return Response.json({ ok: false, error: "Akun tidak ditemukan." }, { status: 404 });
  const target = r.rows[0];
  if (!canManageAccount({ id: u.id, employeeId: u.employee_id, role: u.role, branchId: u.branch_id }, { role: target.role, employeeId: target.employee_id }, target.branch_id)) {
    return Response.json({ ok: false, error: "Anda tidak berhak mengelola akun ini." }, { status: 403 });
  }

  const password = randomPassword();
  await pool.query(`UPDATE users SET password_hash=$1, session_version=session_version+1 WHERE id=$2`, [hashPassword(password), id]);

  const actor = u.name;
  await writeAudit({
    actorId: u.id, actorName: actor, action: "Password reset", targetType: "user", targetId: id,
    detail: r.rows[0].email, at: new Date().toISOString(),
  });

  return Response.json({ ok: true, tempPassword: password });
}
