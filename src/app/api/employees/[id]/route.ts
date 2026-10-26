import { pool } from "@/db/client";
import { canManageEmployee } from "@/lib/server/access";
import { writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";
import type { Role } from "@/lib/types";

import { isHr } from "@/lib/roles";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as Record<string,unknown>;
  const r = await pool.query(
    `SELECT e.*, e.branch_id AS "branchId", e.spv_id AS "spvId", e.manager_id AS "managerId",
     EXISTS (SELECT 1 FROM users u WHERE u.employee_id=e.id AND u.role='super_admin') AS "isSuperAdmin"
     FROM employees e WHERE e.id=$1`,
    [id],
  );
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  const target = r.rows[0];
  if (!canManageEmployee({ id: user.id, employeeId: user.employee_id, role: user.role as Role, branchId: user.branch_id }, target)) {
    return Response.json({ ok: false, error: "Karyawan berada di luar cakupan Anda." }, { status: 403 });
  }

  const name = body.name;
  const email = body.email;
  const phone = body.phone;
  const nik = body.nik;
  const departmentId = body.departmentId ?? body.division;
  const positionId = body.positionId ?? body.position;
  const branchId = body.branchId;
  const workLocationId = body.workLocationId ?? body.location_id;
  const employmentType = body.employmentType;
  const base_salary = body.baseSalary ?? body.base_salary;
  const allowance = body.allowance;
  const join_date = body.joinDate ?? body.join_date;
  const status = body.status;
  const bankName = body.bankName;
  const bankAccount = body.bankAccount;
  const address = body.address;
  const emergencyContact = body.emergencyContact;
  const photoUrl = typeof body.photoUrl === "string" && (body.photoUrl === "" || body.photoUrl.startsWith("/api/uploads/"))
    ? body.photoUrl : undefined;
  const spvId = typeof body.spvId === "string" ? (body.spvId || null) : undefined;
  const mgrId = typeof body.managerId === "string" ? (body.managerId || null) : undefined;
  if (("spvId" in body || "managerId" in body) && [body.spvId, body.managerId].some((value) => value !== undefined && value !== null && typeof value !== "string")) {
    return Response.json({ ok: false, error: "Hierarki supervisor/manager tidak valid." }, { status: 400 });
  }
  const nextBranchId = typeof branchId === "string" ? branchId : target.branch_id;
  if (user.role !== "super_admin" && nextBranchId !== user.branch_id) {
    return Response.json({ ok: false, error: "Tidak dapat memindahkan karyawan ke cabang lain." }, { status: 403 });
  }
  const hierarchy = [
    { id: spvId, role: "supervisor" },
    { id: mgrId, role: "manager" },
  ].filter((item): item is { id: string; role: "supervisor" | "manager" } => Boolean(item.id));
  if (hierarchy.length > 0) {
    const hierarchyR = await pool.query(
      `SELECT e.id, e.branch_id AS "branchId", u.role
       FROM employees e LEFT JOIN users u ON u.employee_id = e.id
       WHERE e.id = ANY($1::text[])`,
      [hierarchy.map((item) => item.id)],
    );
    const references = new Map(hierarchyR.rows.map((row) => [row.id, row]));
    if (hierarchy.some(({ id, role }) => {
      const reference = references.get(id);
      const referenceBranch = reference?.branchId ?? reference?.branch_id;
      return !reference || referenceBranch !== nextBranchId || reference.role !== role;
    })) {
      return Response.json({ ok: false, error: "Hierarki supervisor/manager tidak valid." }, { status: 400 });
    }
  }
  if (typeof departmentId === "string" || typeof workLocationId === "string") {
    const [departmentR, locationR] = await Promise.all([
      typeof departmentId === "string" ? pool.query(`SELECT branch_id FROM departments WHERE id=$1`, [departmentId]) : Promise.resolve({ rows: [] }),
      typeof workLocationId === "string" ? pool.query(`SELECT branch_id FROM work_locations WHERE id=$1`, [workLocationId]) : Promise.resolve({ rows: [] }),
    ]);
    if ((departmentR.rows[0] && departmentR.rows[0].branch_id !== nextBranchId) || (locationR.rows[0] && locationR.rows[0].branch_id !== nextBranchId)) {
      return Response.json({ ok: false, error: "Departemen dan lokasi harus sesuai cabang." }, { status: 400 });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE employees SET
        name=COALESCE($1,name), email=COALESCE($2,email), phone=COALESCE($3,phone), nik=COALESCE($4,nik),
        department_id=COALESCE($5,department_id), position_id=COALESCE($6,position_id), branch_id=COALESCE($7,branch_id),
        work_location_id=COALESCE($8,work_location_id), employment_type=COALESCE($9,employment_type),
        base_salary=COALESCE($10,base_salary), allowance=COALESCE($11,allowance),
        join_date=COALESCE($12,join_date), status=COALESCE($13,status), bank_name=COALESCE($14,bank_name), bank_account=COALESCE($15,bank_account), address=COALESCE($16,address),
        emergency_contact=COALESCE($17::jsonb,emergency_contact),
        photo_url=CASE WHEN $18::text = '' THEN NULL ELSE COALESCE($18::text, photo_url) END,
        spv_id=CASE WHEN $20::text IS NULL THEN spv_id ELSE $20::text END,
        manager_id=CASE WHEN $21::text IS NULL THEN manager_id ELSE $21::text END
       WHERE id=$19`,
      [name ?? null, email ?? null, phone ?? null, nik ?? null, departmentId ?? null, positionId ?? null, branchId ?? null,
       workLocationId ?? null, employmentType ?? null, base_salary ?? null, allowance ?? null, join_date ?? null, status ?? null, bankName ?? null, bankAccount ?? null, address ?? null,
       emergencyContact ? JSON.stringify(emergencyContact) : null, photoUrl ?? null, id, spvId, mgrId],
    );
    if (email) await client.query(`UPDATE users SET email=$1 WHERE employee_id=$2`, [email, id]);
    if (status === "inactive" || status === "active") await client.query(`UPDATE users SET active=$1, session_version=session_version+1 WHERE employee_id=$2`, [status === "active", id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await writeAudit({
    actorId: user.id, actorName: user.name,
    action: "Employee updated", targetType: "employee", targetId: id,
    detail: name || r.rows[0].name, at: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });

  const { id } = await params;
  const r = await pool.query(
    `SELECT e.*, e.branch_id AS "branchId", e.spv_id AS "spvId", e.manager_id AS "managerId",
     EXISTS (SELECT 1 FROM users u WHERE u.employee_id=e.id AND u.role='super_admin') AS "isSuperAdmin"
     FROM employees e WHERE e.id=$1`,
    [id],
  );
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  const target = r.rows[0];
  if (!canManageEmployee({ id: user.id, employeeId: user.employee_id, role: user.role as Role, branchId: user.branch_id }, target)) {
    return Response.json({ ok: false, error: "Karyawan berada di luar cakupan Anda." }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE employees SET status='inactive' WHERE id=$1`, [id]);
    await client.query(`UPDATE users SET active=false, session_version=session_version+1 WHERE employee_id=$1`, [id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  await writeAudit({
    actorId: user.id, actorName: user.name,
    action: "Employee deactivated", targetType: "employee", targetId: id,
    detail: target.name, at: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
