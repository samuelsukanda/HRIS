import { pool } from "@/db/client";
import { canManageEmployee } from "@/lib/server/access";
import { nextId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";
import type { Role } from "@/lib/types";

import { isHr } from "@/lib/roles";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });

  const body = await req.json();
  const { assetId, employeeId } = body as { assetId: string; employeeId: string };
  if (!assetId || !employeeId) return Response.json({ ok: false, error: "Field wajib kosong." }, { status: 400 });

  const assetR = await pool.query(`SELECT * FROM assets WHERE id=$1`, [assetId]);
  if (assetR.rows.length === 0) return Response.json({ ok: false, error: "Aset tidak ditemukan." }, { status: 404 });
  const targetR = await pool.query(`SELECT id, branch_id, spv_id, manager_id FROM employees WHERE id=$1`, [employeeId]);
  if (!targetR.rows.length) return Response.json({ ok: false, error: "Karyawan tidak ditemukan." }, { status: 404 });
  if (!canManageEmployee({ id: user.id, employeeId: user.employee_id, role: user.role as Role, branchId: user.branch_id }, targetR.rows[0])) {
    return Response.json({ ok: false, error: "Karyawan berada di luar cakupan Anda." }, { status: 403 });
  }
  if (assetR.rows[0].branch_id && assetR.rows[0].branch_id !== targetR.rows[0].branch_id) {
    return Response.json({ ok: false, error: "Aset dan karyawan harus berada pada cabang yang sama." }, { status: 409 });
  }

  const id = await nextId("asset_assignments", "AST");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(`SELECT status FROM assets WHERE id=$1 FOR UPDATE`, [assetId]);
    if (locked.rows[0]?.status !== "available") {
      await client.query("ROLLBACK");
      return Response.json({ ok: false, error: "Aset tidak tersedia." }, { status: 409 });
    }
    await client.query(
      `INSERT INTO asset_assignments (id,asset_id,employee_id,assigned_at,returned_at)
       VALUES ($1,$2,$3,NOW(),NULL)`,
      [id, assetId, employeeId],
    );
    await client.query(`UPDATE assets SET status='assigned' WHERE id=$1`, [assetId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const targetNameR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [employeeId]);
  await writeAudit({
    actorId: user.id, actorName: user.name,
    action: "Asset assigned", targetType: "asset_assignment", targetId: id,
    detail: `${assetR.rows[0].name} → ${targetNameR.rows[0]?.name ?? employeeId}`, at: new Date().toISOString(),
  });

  return Response.json({ ok: true, id });
}
