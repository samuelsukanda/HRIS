import { pool } from "@/db/client";
import { nextId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";
import { scrypt } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

function randomPassword() {
  return Math.random().toString(36).slice(-8) + "A1!";
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const r = await pool.query(`SELECT e.* FROM employees e ORDER BY e.name`);
  return Response.json({ employees: r.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });

  const body = await req.json() as Record<string,any>;
  const name = body.name;
  const email = body.email;
  const phone = body.phone ?? "";
  const nik = body.nik ?? String(Date.now()).slice(-16).padStart(16,"0");
  const departmentId = body.departmentId ?? body.division ?? "DP-TEC";
  const positionId = body.positionId ?? body.position ?? "PS-DEV";
  const branchId = body.branchId ?? "BR-JKT";
  const workLocationId = body.workLocationId ?? body.location_id ?? "LOC-JKT-01";
  const employmentType = body.employmentType ?? "probation";
  const base_salary = body.baseSalary ?? body.base_salary ?? 5000000;
  const allowance = body.allowance ?? 750000;
  const join_date = body.joinDate ?? body.join_date ?? new Date().toISOString().slice(0,10);
  const role = body.role ?? "employee";

  if (!name || !email) return Response.json({ ok: false, error: "Field wajib kosong." }, { status: 400 });

  const dup = await pool.query(`SELECT id FROM employees WHERE email=$1`, [email]);
  if (dup.rows.length > 0) return Response.json({ ok: false, error: "Email sudah terdaftar." }, { status: 409 });

  const id = await nextId("employees", "EMP");
  const password = randomPassword();
  const salt = Math.random().toString(36).slice(2, 10);
  const hash = (await scryptAsync(password + salt, "hris-salt", 64)) as Buffer;
  const userId = await nextId("users", "USR");

  await pool.query(
    `INSERT INTO employees (id,nik,name,gender,birth_place,birth_date,address,phone,email,join_date,department_id,position_id,branch_id,work_location_id,employment_type,status,bank_name,bank_account,emergency_contact,face_registered,base_salary,allowance)
     VALUES ($1,$2,$3,'L','Jakarta','1995-01-01','', $4,$5,$6,$7,$8,$9,$10,$11,'active','BCA','','{}',false,$12,$13)`,
    [id, nik, name, phone, email, join_date, departmentId, positionId, branchId, workLocationId, employmentType, base_salary, allowance],
  );

  await pool.query(
    `INSERT INTO users (id,email,employee_id,role,password_hash) VALUES ($1,$2,$3,$4,$5)`,
    [userId, email, id, role, hash.toString("hex") + ":" + salt],
  );

  await writeAudit({
    actorId: user.id, actorName: (await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id])).rows[0]?.name ?? user.employee_id,
    action: "Employee created", targetType: "employee", targetId: id,
    detail: `${name} (${id})`, at: new Date().toISOString(),
  });

  return Response.json({ ok: true, id, userId, tempPassword: password });
}
