import { pool } from "@/db/client";
import { writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as Record<string,any>;
  const r = await pool.query(`SELECT * FROM employees WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });

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

  await pool.query(
    `UPDATE employees SET
      name=COALESCE($1,name), email=COALESCE($2,email), phone=COALESCE($3,phone), nik=COALESCE($4,nik),
      department_id=COALESCE($5,department_id), position_id=COALESCE($6,position_id), branch_id=COALESCE($7,branch_id),
      work_location_id=COALESCE($8,work_location_id), employment_type=COALESCE($9,employment_type),
      base_salary=COALESCE($10,base_salary), allowance=COALESCE($11,allowance),
      join_date=COALESCE($12,join_date), status=COALESCE($13,status), bank_name=COALESCE($14,bank_name), bank_account=COALESCE($15,bank_account), address=COALESCE($16,address)
     WHERE id=$17`,
    [name ?? null, email ?? null, phone ?? null, nik ?? null, departmentId ?? null, positionId ?? null, branchId ?? null,
     workLocationId ?? null, employmentType ?? null, base_salary ?? null, allowance ?? null, join_date ?? null, status ?? null, bankName ?? null, bankAccount ?? null, address ?? null, id],
  );

  if (email) {
    await pool.query(`UPDATE users SET email=$1 WHERE employee_id=$2`, [email, id]);
  }

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({
    actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id,
    action: "Employee updated", targetType: "employee", targetId: id,
    detail: name || r.rows[0].name, at: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });

  const { id } = await params;
  const r = await pool.query(`SELECT * FROM employees WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });

  await pool.query(`UPDATE employees SET status='inactive' WHERE id=$1`, [id]);
  // users role keep but could be disabled; we don't have former_employee role - keep as is
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({
    actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id,
    action: "Employee deactivated", targetType: "employee", targetId: id,
    detail: r.rows[0].name, at: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
