import { pool } from "@/db/client";
import { writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });

  const { id } = await params;
  const r = await pool.query(`SELECT * FROM asset_assignments WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });

  const asgn = r.rows[0];
  if (asgn.returned_at) return Response.json({ ok: false, error: "Sudah dikembalikan." }, { status: 409 });

  await pool.query(
    `UPDATE asset_assignments SET returned_at=NOW() WHERE id=$1`,
    [id],
  );
  await pool.query(`UPDATE assets SET status='available' WHERE id=$1`, [asgn.asset_id]);

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  const assetR = await pool.query(`SELECT name FROM assets WHERE id=$1`, [asgn.asset_id]);
  await writeAudit({
    actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id,
    action: "Asset returned", targetType: "asset_assignment", targetId: id,
    detail: `${assetR.rows[0]?.name ?? asgn.asset_id} returned`, at: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
