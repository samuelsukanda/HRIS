import { pool } from "@/db/client";
import { nextId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";
import { hashPassword, randomPassword } from "@/lib/server/auth";

import { isHr } from "@/lib/roles";

async function resolveFk(table: string, id: unknown, fallbackCol = "id"): Promise<string | null> {
  if (typeof id === "string" && id.trim()) {
    const r = await pool.query(`SELECT ${fallbackCol} FROM ${table} WHERE id=$1`, [id.trim()]);
    if (r.rows.length > 0) return id.trim();
    return null; // invalid id → caller returns 400
  }
  return null;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (isHr(user.role)) {
    const r = user.role === "super_admin"
      ? await pool.query(`SELECT e.* FROM employees e ORDER BY e.name`)
      : await pool.query(`SELECT e.* FROM employees e WHERE e.branch_id = $1 ORDER BY e.name`, [user.branch_id]);
    return Response.json({ employees: r.rows });
  }
  // non-HR: kolom direktori saja, tanpa NIK/gaji/bank/kontak/wajah
  const r = user.role === "employee"
    ? await pool.query(`SELECT id,name,email,department_id,position_id,branch_id,work_location_id,employment_type,status,join_date FROM employees WHERE branch_id=$1 ORDER BY name`, [user.branch_id])
    : user.role === "manager" || user.role === "supervisor"
      ? await pool.query(`SELECT id,name,email,department_id,position_id,branch_id,work_location_id,employment_type,status,join_date FROM employees WHERE id=$1 OR spv_id=$1 OR manager_id=$1 ORDER BY name`, [user.employee_id])
      : await pool.query(`SELECT id,name,email,department_id,position_id,branch_id,work_location_id,employment_type,status,join_date FROM employees ORDER BY name`);
  return Response.json({ employees: r.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });

  const body = await req.json() as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone : "";
  const address = typeof body.address === "string" ? body.address : "";
  const nik = typeof body.nik === "string" && body.nik ? body.nik : String(Date.now()).slice(-16).padStart(16, "0");
  if (!name || !email) return Response.json({ ok: false, error: "Nama dan email wajib diisi." }, { status: 400 });

  const departmentId = await resolveFk("departments", (body.departmentId ?? body.division) as unknown);
  const positionId = await resolveFk("positions", (body.positionId ?? body.position) as unknown);
  const branchId = await resolveFk("branches", body.branchId as unknown);
  const workLocationId = await resolveFk("work_locations", (body.workLocationId ?? body.location_id) as unknown);
  const spvId = typeof body.spvId === "string" && body.spvId ? body.spvId : null;
  const managerId = typeof body.managerId === "string" && body.managerId ? body.managerId : null;
  if (!departmentId) return Response.json({ ok: false, error: "Departemen tidak valid / belum ada data master." }, { status: 400 });
  if (!positionId) return Response.json({ ok: false, error: "Jabatan tidak valid / belum ada data master." }, { status: 400 });
  if (!branchId) return Response.json({ ok: false, error: "Cabang tidak valid / belum ada data master." }, { status: 400 });
  if (!workLocationId) return Response.json({ ok: false, error: "Lokasi kerja tidak valid / belum ada data master." }, { status: 400 });
  const [branchR, departmentR, locationR] = await Promise.all([
    pool.query(`SELECT id FROM branches WHERE id=$1`, [branchId]),
    pool.query(`SELECT id, branch_id FROM departments WHERE id=$1`, [departmentId]),
    pool.query(`SELECT id, branch_id FROM work_locations WHERE id=$1`, [workLocationId]),
  ]);
  if (!branchR.rows.length || departmentR.rows[0]?.branch_id !== branchId || locationR.rows[0]?.branch_id !== branchId) {
    return Response.json({ ok: false, error: "Departemen dan lokasi harus sesuai cabang." }, { status: 400 });
  }
  if (user.role !== "super_admin" && branchId !== user.branch_id) {
    return Response.json({ ok: false, error: "Tidak dapat membuat karyawan di cabang lain." }, { status: 403 });
  }

  const employmentType = typeof body.employmentType === "string" && body.employmentType ? body.employmentType : "probation";
  // whitelist role — super_admin hanya boleh dibuat oleh super_admin
  const role = ["employee", "manager", "supervisor", "hr"].includes(body.role as string)
    ? (body.role as string)
    : "employee";
  if (body.role === "super_admin" && user.role !== "super_admin") {
    return Response.json({ ok: false, error: "Hanya super_admin yang dapat membuat super_admin." }, { status: 403 });
  }
  const finalRole = body.role === "super_admin" ? "super_admin" : role;
  const base_salary = Number(body.baseSalary ?? body.base_salary) || 0;
  const allowance = Number(body.allowance) || 0;
  const bankName = typeof body.bankName === "string" ? body.bankName : "";
  const bankAccount = typeof body.bankAccount === "string" ? body.bankAccount : "";
  const emergencyContact = body.emergencyContact && typeof body.emergencyContact === "object"
    ? body.emergencyContact as Record<string, string>
    : {};
  const join_date = (typeof body.joinDate === "string" && body.joinDate) || (typeof body.join_date === "string" && (body.join_date as string)) || new Date().toISOString().slice(0, 10);

  const dup = await pool.query(`SELECT id FROM employees WHERE lower(email)=lower($1)`, [email]);
  if (dup.rows.length > 0) return Response.json({ ok: false, error: "Email sudah terdaftar." }, { status: 409 });

  const id = await nextId("employees", "EMP");
  const password = randomPassword();
  const passwordHash = hashPassword(password);
  const userId = await nextId("users", "USR");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO employees (id,nik,name,gender,birth_place,birth_date,address,phone,email,join_date,department_id,position_id,spv_id,manager_id,branch_id,work_location_id,employment_type,status,bank_name,bank_account,emergency_contact,face_registered,base_salary,allowance)
       VALUES ($1,$2,$3,'L','Jakarta','1995-01-01',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'active',$15,$16,$17,false,$18,$19)`,
      [id, nik, name, address, phone, email, join_date, departmentId, positionId, spvId, managerId, branchId, workLocationId, employmentType, bankName, bankAccount, JSON.stringify(emergencyContact), base_salary, allowance],
    );
    await client.query(
      `INSERT INTO users (id,email,employee_id,role,password_hash) VALUES ($1,$2,$3,$4,$5)`,
      [userId, email, id, finalRole, passwordHash],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await writeAudit({
    actorId: user.id, actorName: user.name,
    action: "Employee created", targetType: "employee", targetId: id,
    detail: `${name} (${id})`, at: new Date().toISOString(),
  });

  return Response.json({ ok: true, id, userId, tempPassword: password });
}
