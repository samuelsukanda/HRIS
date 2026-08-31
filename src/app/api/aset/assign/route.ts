import { pool } from "@/db/client";
import { nextId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });

  const body = await req.json();
  const { assetId, employeeId } = body as { assetId: string; employeeId: string };
  if (!assetId || !employeeId) return Response.json({ ok: false, error: "Field wajib kosong." }, { status: 400 });

  const assetR = await pool.query(`SELECT * FROM assets WHERE id=$1`, [assetId]);
  if (assetR.rows.length === 0) return Response.json({ ok: false, error: "Aset tidak ditemukan." }, { status: 404 });
  if (assetR.rows[0].status !== "available") return Response.json({ ok: false, error: "Aset tidak tersedia." }, { status: 409 });

  const id = await nextId("asset_assignments", "AST");
  await pool.query(
    `INSERT INTO asset_assignments (id,asset_id,employee_id,assigned_at,returned_at)
     VALUES ($1,$2,$3,NOW(),NULL)`,
    [id, assetId, employeeId],
  );
  await pool.query(`UPDATE assets SET status='assigned' WHERE id=$1`, [assetId]);

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  const targetR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [employeeId]);
  await writeAudit({
    actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id,
    action: "Asset assigned", targetType: "asset_assignment", targetId: id,
    detail: `${assetR.rows[0].name} → ${targetR.rows[0]?.name ?? employeeId}`, at: new Date().toISOString(),
  });

  return Response.json({ ok: true, id });
}
