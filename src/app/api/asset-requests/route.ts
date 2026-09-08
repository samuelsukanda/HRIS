import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { nextId, writeAudit, writeNotification } from "@/lib/server/state";

const HR = ["hr_manager","hr_admin","super_admin"];

export async function GET(req: Request) {
  const u = await getSessionUser(); if (!u) return Response.json({ ok: false }, { status: 401 });
  const r = u.role === "employee"
    ? await pool.query(`SELECT ar.*, e.name emp_name FROM asset_requests ar JOIN employees e ON e.id=ar.employee_id WHERE ar.employee_id=$1 ORDER BY ar.created_at DESC`, [u.employee_id])
    : await pool.query(`SELECT ar.*, e.name emp_name FROM asset_requests ar JOIN employees e ON e.id=ar.employee_id ORDER BY ar.created_at DESC`);
  return Response.json({ requests: r.rows });
}

export async function POST(req: Request) {
  const u = await getSessionUser(); if (!u) return Response.json({ ok: false }, { status: 401 });
  const body = await req.json() as Record<string, string>;
  const { category, description } = body;
  if (!category || !description?.trim()) return Response.json({ ok: false, error: "Field wajib." }, { status: 400 });
  const id = await nextId("asset_requests", "ARQ");
  await pool.query(`INSERT INTO asset_requests (id,employee_id,category,description,status,created_at) VALUES ($1,$2,$3,$4,'pending',NOW())`,
    [id, u.employee_id, category, description.trim()]);
  const emp = (await pool.query(`SELECT name FROM employees WHERE id=$1`, [u.employee_id])).rows[0]?.name ?? u.employee_id;
  await writeAudit({ actorId: u.id, actorName: emp, action: "Asset request submitted", targetType: "asset_request", targetId: id, detail: `${category}: ${description.trim().slice(0, 40)}`, at: new Date().toISOString() });
  const hrs = await pool.query(`SELECT id FROM users WHERE role IN ('hr_manager','hr_admin','super_admin') AND active=true`);
  for (const h of hrs.rows) {
    await writeNotification({ userId: h.id, title: "Permintaan Aset Baru", body: `${emp} meminta aset ${category}.`, type: "approval", link: "/admin/aset" });
  }
  return Response.json({ ok: true, id });
}
