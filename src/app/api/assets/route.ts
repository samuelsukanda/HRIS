import { pool } from "@/db/client";
import { creatorBranchId, nextId, notifySameBranch, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

import { isHr } from "@/lib/roles";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const branchId = user.role === "super_admin" ? null : await creatorBranchId(user.employee_id);
  const r = branchId
    ? await pool.query(`SELECT * FROM assets WHERE branch_id IS NULL OR branch_id=$1 ORDER BY name`, [branchId])
    : await pool.query(`SELECT * FROM assets ORDER BY name`);
  return Response.json({ assets: r.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });
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
  const branchId = user.role === "super_admin" ? null : await creatorBranchId(user.employee_id);
  const id = await nextId("assets", "AST");
  await pool.query(`INSERT INTO assets (id,name,category,brand,model,serial_number,purchase_date,purchase_price,status,notes,branch_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, name, category, str(body.brand), str(body.model), serial, purchaseDate, price, status, str(body.notes), branchId]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  const actorName = empR.rows[0]?.name ?? user.employee_id;
  await writeAudit({ actorId: user.id, actorName, action: "Asset created", targetType: "asset", targetId: id, detail: name, at: new Date().toISOString() });
  await notifySameBranch(branchId, user.id, {
    title: "Aset Baru",
    body: `${actorName} menambahkan aset: ${name}`,
    type: "info",
    link: "/admin/aset",
  });
  return Response.json({ ok: true, id });
}
