import { pool } from "@/db/client";
import { creatorBranchId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

import { isHr } from "@/lib/roles";

async function assertJobBranch(user: { role: string; employee_id: string }, departmentId: string) {
  if (user.role === "super_admin") return null;
  const myBranch = await creatorBranchId(user.employee_id);
  if (!myBranch || !departmentId) return null;
  const d = await pool.query(`SELECT branch_id FROM departments WHERE id=$1`, [departmentId]);
  const rowBranch = d.rows[0]?.branch_id ?? null;
  if (rowBranch && rowBranch !== myBranch) {
    return Response.json({ ok: false, error: "Lowongan milik cabang lain." }, { status: 403 });
  }
  return null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const body = await req.json() as Record<string, string | number | null | undefined>;
  const r = await pool.query(`SELECT * FROM job_postings WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  const dept = body.departmentId ?? body.department ?? r.rows[0].department_id;
  const denied = await assertJobBranch(user, dept);
  if (denied) return denied;
  const salary = body.salaryRange ?? body.salary_range ?? (body.salary_min!=null||body.salary_max!=null ? `${body.salary_min ?? ""}-${body.salary_max ?? ""}` : null);
  await pool.query(`UPDATE job_postings SET title=COALESCE($1,title), department_id=COALESCE($2,department_id), description=COALESCE($3,description), requirements=COALESCE($4,requirements), salary_range=COALESCE($5,salary_range), status=COALESCE($6,status) WHERE id=$7`,
    [body.title ?? null, body.departmentId ?? body.department ?? null, body.description ?? null, body.requirements ?? null, salary, body.status ?? null, id]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Job posting updated", targetType: "job_posting", targetId: id, detail: body.title || r.rows[0].title, at: new Date().toISOString() });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const r = await pool.query(`SELECT * FROM job_postings WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  const denied = await assertJobBranch(user, r.rows[0].department_id);
  if (denied) return denied;
  await pool.query(`DELETE FROM job_postings WHERE id=$1`, [id]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Job posting deleted", targetType: "job_posting", targetId: id, detail: r.rows[0]?.title ?? id, at: new Date().toISOString() });
  return Response.json({ ok: true });
}
