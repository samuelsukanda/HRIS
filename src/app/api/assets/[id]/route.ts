import { pool } from "@/db/client";
import { writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

import { isHr } from "@/lib/roles";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;
  const r = await pool.query(`SELECT * FROM assets WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  const serial = (body.serialNumber ?? body.serial_number) as string | undefined;
  const pdate = (body.purchaseDate ?? body.purchase_date) as string | undefined;
  const price = (body.purchasePrice ?? body.purchase_price) as number | undefined;
  await pool.query(`UPDATE assets SET name=COALESCE($1,name), category=COALESCE($2,category), brand=COALESCE($3,brand), model=COALESCE($4,model), serial_number=COALESCE($5,serial_number), purchase_date=COALESCE($6,purchase_date), purchase_price=COALESCE($7,purchase_price), status=COALESCE($8,status), notes=COALESCE($9,notes) WHERE id=$10`,
    [body.name ?? null, body.category ?? null, body.brand ?? null, body.model ?? null, serial ?? null, pdate ?? null, price ?? null, body.status ?? null, body.notes ?? null, id]);
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Asset updated", targetType: "asset", targetId: id, detail: body.name || r.rows[0].name, at: new Date().toISOString() });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const r = await pool.query(`SELECT * FROM assets WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const active = await client.query(
      `SELECT e.name FROM asset_assignments aa JOIN employees e ON e.id=aa.employee_id
       WHERE aa.asset_id=$1 AND aa.returned_at IS NULL LIMIT 1`,
      [id],
    );
    if (active.rows[0]) {
      await client.query("ROLLBACK");
      return Response.json({ ok: false, error: `Aset masih ditugaskan ke ${active.rows[0].name} — kembalikan asetnya dulu sebelum dihapus.` }, { status: 409 });
    }
    await client.query(`DELETE FROM asset_assignments WHERE asset_id=$1`, [id]);
    await client.query(`DELETE FROM assets WHERE id=$1`, [id]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    if ((e as { code?: string }).code === "23503") return Response.json({ ok: false, error: "Aset masih dipakai data lain dan tidak bisa dihapus." }, { status: 409 });
    return Response.json({ ok: false, error: "Gagal menghapus aset." }, { status: 500 });
  } finally {
    client.release();
  }
  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({ actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id, action: "Asset deleted", targetType: "asset", targetId: id, detail: r.rows[0]?.name ?? id, at: new Date().toISOString() });
  return Response.json({ ok: true });
}
