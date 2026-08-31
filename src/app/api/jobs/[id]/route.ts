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
  const r = await pool.query(`SELECT * FROM job_postings WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  const dept = body.departmentId ?? body.department;
  const salary = body.salaryRange ?? body.salary_range ?? (body.salary_min!=null||body.salary_max!=null ? `${body.salary_min ?? ""}-${body.salary_max ?? ""}` : null);
  await pool.query(`UPDATE job_postings SET title=COALESCE($1,title), department_id=COALESCE($2,department_id), description=COALESCE($3,description), requirements=COALESCE($4,requirements), salary_range=COALESCE($5,salary_range), status=COALESCE($6,status) WHERE id=$7`,
    [body.title ?? null, dept ?? null, body.description ?? null, body.requirements ?? null, salary, body.status ?? null, id]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Job posting updated", targetType: "job_posting", targetId: id, detail: body.title || r.rows[0].title, at: new Date().toISOString() });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const r = await pool.query(`SELECT * FROM job_postings WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  await pool.query(`DELETE FROM job_postings WHERE id=$1`, [id]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Job posting deleted", targetType: "job_posting", targetId: id, detail: r.rows[0]?.title ?? id, at: new Date().toISOString() });
  return Response.json({ ok: true });
}
