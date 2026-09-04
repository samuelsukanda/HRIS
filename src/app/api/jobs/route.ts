import { pool } from "@/db/client";
import { nextId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const r = await pool.query(`SELECT * FROM job_postings ORDER BY created_at DESC`);
  return Response.json({ jobs: r.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });
  const body = await req.json() as Record<string,string>;
  const title = body.title;
  let departmentId = body.departmentId ?? body.department;
  if (!departmentId) {
    const f = await pool.query(`SELECT id FROM departments ORDER BY id LIMIT 1`);
    departmentId = f.rows[0]?.id ?? null;
  } else {
    const chk = await pool.query(`SELECT id FROM departments WHERE id=$1`, [departmentId]);
    if (chk.rows.length === 0) return Response.json({ ok: false, error: "Departemen tidak valid." }, { status: 400 });
  }
  const description = body.description ?? "";
  const requirements = body.requirements ?? "";
  const salaryRange = (body.salaryRange ?? body.salary_range ?? `${body.salary_min ?? ""}-${body.salary_max ?? ""}`.replace(/^-|-$/g,"")) || "Negotiable";
  const status = body.status ?? "open";
  if (!title) return Response.json({ ok: false, error: "Field wajib kosong." }, { status: 400 });
  if (!departmentId) return Response.json({ ok: false, error: "Belum ada data departemen." }, { status: 400 });
  const id = await nextId("job_postings", "JOB");
  await pool.query(`INSERT INTO job_postings (id,title,department_id,description,requirements,salary_range,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
    [id, title, departmentId, description, requirements, salaryRange, status]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Job posting created", targetType: "job_posting", targetId: id, detail: title, at: new Date().toISOString() });
  return Response.json({ ok: true, id });
}
