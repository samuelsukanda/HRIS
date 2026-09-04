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
  const body = await req.json() as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const name = str(body.name);
  const category = str(body.category);
  if (!name || !category) return Response.json({ ok: false, error: "Field wajib kosong." }, { status: 400 });
  const serial = str(body.serialNumber) ?? str(body.serial_number) ?? "";
  const dateRaw = str(body.purchaseDate) ?? str(body.purchase_date);
  const purchaseDate = dateRaw && !isNaN(Date.parse(dateRaw)) ? dateRaw.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const price = Number(body.purchasePrice ?? body.purchase_price) || null;
  const status = str(body.status) ?? "available";
  const id = await nextId("assets", "AST");
  await pool.query(`INSERT INTO assets (id,name,category,brand,model,serial_number,purchase_date,purchase_price,status,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, name, category, str(body.brand), str(body.model), serial, purchaseDate, price, status, str(body.notes)]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Asset created", targetType: "asset", targetId: id, detail: name, at: new Date().toISOString() });
  return Response.json({ ok: true, id });
}
