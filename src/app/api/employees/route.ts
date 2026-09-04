import { pool } from "@/db/client";
import { nextId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";
import { hashPassword } from "@/lib/server/auth";

const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

function randomPassword() {
  return Math.random().toString(36).slice(-8) + "A1!";
}

async function resolveFk(table: string, id: unknown, fallbackCol = "id"): Promise<string | null> {
  if (typeof id === "string" && id.trim()) {
    const r = await pool.query(`SELECT ${fallbackCol} FROM ${table} WHERE id=$1`, [id.trim()]);
    if (r.rows.length > 0) return id.trim();
    return null; // invalid id → caller returns 400
  }
  const r = await pool.query(`SELECT ${fallbackCol} FROM ${table} ORDER BY id LIMIT 1`);
  return r.rows[0]?.[fallbackCol] ?? null;
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

  const body = await req.json() as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone : "";
  const nik = typeof body.nik === "string" && body.nik ? body.nik : String(Date.now()).slice(-16).padStart(16, "0");
  if (!name || !email) return Response.json({ ok: false, error: "Nama dan email wajib diisi." }, { status: 400 });

  const departmentId = await resolveFk("departments", (body.departmentId ?? body.division) as unknown);
  const positionId = await resolveFk("positions", (body.positionId ?? body.position) as unknown);
  const branchId = await resolveFk("branches", body.branchId as unknown);
  const workLocationId = await resolveFk("work_locations", (body.workLocationId ?? body.location_id) as unknown);
  if (!departmentId) return Response.json({ ok: false, error: "Departemen tidak valid / belum ada data master." }, { status: 400 });
  if (!positionId) return Response.json({ ok: false, error: "Posisi tidak valid / belum ada data master." }, { status: 400 });
  if (!branchId) return Response.json({ ok: false, error: "Cabang tidak valid / belum ada data master." }, { status: 400 });
  if (!workLocationId) return Response.json({ ok: false, error: "Lokasi kerja tidak valid / belum ada data master." }, { status: 400 });

  const employmentType = typeof body.employmentType === "string" ? body.employmentType : "probation";
  const base_salary = Number(body.baseSalary ?? body.base_salary) || 5000000;
  const allowance = Number(body.allowance) || 750000;
  const join_date = (typeof body.joinDate === "string" && body.joinDate) || (typeof body.join_date === "string" && (body.join_date as string)) || new Date().toISOString().slice(0, 10);
  const role = typeof body.role === "string" ? body.role : "employee";

  const dup = await pool.query(`SELECT id FROM employees WHERE email=$1`, [email]);
  if (dup.rows.length > 0) return Response.json({ ok: false, error: "Email sudah terdaftar." }, { status: 409 });

  const id = await nextId("employees", "EMP");
  const password = randomPassword();
  const passwordHash = hashPassword(password);
  const userId = await nextId("users", "USR");

  await pool.query(
    `INSERT INTO employees (id,nik,name,gender,birth_place,birth_date,address,phone,email,join_date,department_id,position_id,branch_id,work_location_id,employment_type,status,bank_name,bank_account,emergency_contact,face_registered,base_salary,allowance)
     VALUES ($1,$2,$3,'L','Jakarta','1995-01-01','', $4,$5,$6,$7,$8,$9,$10,$11,'active','BCA','','{}',false,$12,$13)`,
    [id, nik, name, phone, email, join_date, departmentId, positionId, branchId, workLocationId, employmentType, base_salary, allowance],
  );

  await pool.query(
    `INSERT INTO users (id,email,employee_id,role,password_hash) VALUES ($1,$2,$3,$4,$5)`,
    [userId, email, id, role, passwordHash],
  );

  await writeAudit({
    actorId: user.id, actorName: (await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id])).rows[0]?.name ?? user.employee_id,
    action: "Employee created", targetType: "employee", targetId: id,
    detail: `${name} (${id})`, at: new Date().toISOString(),
  });

  return Response.json({ ok: true, id, userId, tempPassword: password });
}
