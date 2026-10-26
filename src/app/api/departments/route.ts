import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { nextId, writeAudit } from "@/lib/server/state";
import { isHr } from "@/lib/roles";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const r = user.role === "super_admin"
    ? await pool.query(`SELECT * FROM departments ORDER BY id`)
    : await pool.query(`SELECT * FROM departments WHERE branch_id=$1 ORDER BY id`, [user.branch_id]);
  return Response.json({ departments: r.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !isHr(user.role)) return Response.json({ ok: false }, { status: 403 });
  const body = await req.json() as { name?: string; branch_id?: string; branchId?: string };
  const branchId = body.branchId ?? body.branch_id ?? user.branch_id;
  if (!body.name?.trim() || !branchId) return Response.json({ ok: false, error: "Field wajib" }, { status: 400 });
  if (user.role !== "super_admin" && branchId !== user.branch_id) return Response.json({ ok: false, error: "Departemen berada di luar cabang Anda." }, { status: 403 });
  const id = await nextId("departments", "DP");
  await pool.query(`INSERT INTO departments (id,name,branch_id) VALUES ($1,$2,$3)`, [id, body.name.trim(), branchId]);
  const name = user.name;
  await writeAudit({ actorId: user.id, actorName: name, action: "Department created", targetType: "department", targetId: id, detail: body.name, at: new Date().toISOString() });
  return Response.json({ ok: true, id });
}
