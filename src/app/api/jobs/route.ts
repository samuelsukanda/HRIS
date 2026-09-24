import { pool } from "@/db/client";
import { creatorBranchId, nextId, notifySameBranch, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

import { isHr } from "@/lib/roles";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const branchId = user.role === "super_admin" ? null : await creatorBranchId(user.employee_id);
  const r = branchId
    ? await pool.query(
        `SELECT j.* FROM job_postings j
         LEFT JOIN departments d ON d.id = j.department_id
         WHERE d.branch_id IS NULL OR d.branch_id = $1
         ORDER BY j.created_at DESC`,
        [branchId],
      )
    : await pool.query(`SELECT * FROM job_postings ORDER BY created_at DESC`);
  return Response.json({ jobs: r.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });
  const body = await req.json() as Record<string,string>;
  const title = body.title;
  const myBranch = user.role === "super_admin" ? null : await creatorBranchId(user.employee_id);
  let departmentId = body.departmentId ?? body.department;
  if (!departmentId) {
    const f = myBranch
      ? await pool.query(`SELECT id FROM departments WHERE branch_id=$1 ORDER BY id LIMIT 1`, [myBranch])
      : await pool.query(`SELECT id FROM departments ORDER BY id LIMIT 1`);
    departmentId = f.rows[0]?.id ?? null;
  } else {
    const chk = await pool.query(`SELECT id, branch_id FROM departments WHERE id=$1`, [departmentId]);
    if (chk.rows.length === 0) return Response.json({ ok: false, error: "Departemen tidak valid." }, { status: 400 });
    if (myBranch && chk.rows[0].branch_id && chk.rows[0].branch_id !== myBranch) {
      return Response.json({ ok: false, error: "Departemen milik cabang lain." }, { status: 403 });
    }
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
  const actorName = empR.rows[0]?.name ?? user.employee_id;
  await writeAudit({ actorId: user.id, actorName, action: "Job posting created", targetType: "job_posting", targetId: id, detail: title, at: new Date().toISOString() });
  await notifySameBranch(myBranch, user.id, {
    title: "Lowongan Baru",
    body: `${actorName} membuka lowongan: ${title}`,
    type: "info",
    link: "/admin/rekrutmen",
  });
  return Response.json({ ok: true, id });
}
