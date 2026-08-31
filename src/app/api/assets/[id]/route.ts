import { pool } from "@/db/client";
import { writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const r = await pool.query(`SELECT * FROM assets WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  await pool.query(`UPDATE assets SET name=COALESCE($1,name), category=COALESCE($2,category), brand=COALESCE($3,brand), model=COALESCE($4,model), serial_number=COALESCE($5,serial_number), purchase_date=COALESCE($6,purchase_date), purchase_price=COALESCE($7,purchase_price), status=COALESCE($8,status), notes=COALESCE($9,notes) WHERE id=$10`,
    [body.name ?? null, body.category ?? null, body.brand ?? null, body.model ?? null, body.serial_number ?? null, body.purchase_date ?? null, body.purchase_price ?? null, body.status ?? null, body.notes ?? null, id]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Asset updated", targetType: "asset", targetId: id, detail: body.name || r.rows[0].name, at: new Date().toISOString() });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const r = await pool.query(`SELECT * FROM assets WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  await pool.query(`DELETE FROM assets WHERE id=$1`, [id]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Asset deleted", targetType: "asset", targetId: id, detail: r.rows[0]?.name ?? id, at: new Date().toISOString() });
  return Response.json({ ok: true });
}
