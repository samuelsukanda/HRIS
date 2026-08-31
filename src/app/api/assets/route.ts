import { pool } from "@/db/client";
import { nextId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const r = await pool.query(`SELECT * FROM assets ORDER BY name`);
  return Response.json({ assets: r.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });
  const body = await req.json();
  const { name, category, brand, model, serial_number, purchase_date, purchase_price, status, notes } = body;
  if (!name || !category) return Response.json({ ok: false, error: "Field wajib kosong." }, { status: 400 });
  const id = await nextId("assets", "AST");
  await pool.query(`INSERT INTO assets (id,name,category,brand,model,serial_number,purchase_date,purchase_price,status,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, name, category, brand || null, model || null, serial_number || null, purchase_date || null, purchase_price || null, status || "available", notes || null]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Asset created", targetType: "asset", targetId: id, detail: name, at: new Date().toISOString() });
  return Response.json({ ok: true, id });
}
