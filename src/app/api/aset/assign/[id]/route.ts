import { pool } from "@/db/client";
import { writeAudit, writeNotification } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const { id } = await params;
  const r = await pool.query(`SELECT * FROM asset_assignments WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });

  const asgn = r.rows[0];
  if (asgn.returned_at) return Response.json({ ok: false, error: "Sudah dikembalikan." }, { status: 409 });

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  const actorName = empR.rows[0]?.name ?? user.employee_id;
  const assetR = await pool.query(`SELECT name FROM assets WHERE id=$1`, [asgn.asset_id]);
  const assetName = assetR.rows[0]?.name ?? asgn.asset_id;

  // Karyawan pemilik: ajukan pengembalian (bukan eksekusi langsung)
  if (!HR_ROLES.includes(user.role)) {
    if (asgn.employee_id !== user.employee_id) return Response.json({ ok: false, error: "Bukan aset Anda." }, { status: 403 });
    if (asgn.return_requested_at) return Response.json({ ok: false, error: "Sudah diajukan, menunggu HR." }, { status: 409 });
    await pool.query(`UPDATE asset_assignments SET return_requested_at=NOW() WHERE id=$1`, [id]);
    await writeAudit({
      actorId: user.id, actorName,
      action: "Asset return requested", targetType: "asset_assignment", targetId: id,
      detail: `${assetName} — menunggu konfirmasi HR`, at: new Date().toISOString(),
    });
    const hrs = await pool.query(`SELECT id FROM users WHERE role IN ('hr_manager','hr_admin','super_admin') AND active=true`);
    for (const h of hrs.rows) {
      await writeNotification({ userId: h.id, title: "Permintaan Pengembalian Aset", body: `${actorName} mengajukan pengembalian ${assetName}.`, type: "approval", link: "/admin/aset" });
    }
    return Response.json({ ok: true, requested: true });
  }

  // HR: konfirmasi pengembalian
  await pool.query(
    `UPDATE asset_assignments SET returned_at=NOW(), return_requested_at=NULL WHERE id=$1`,
    [id],
  );
  await pool.query(`UPDATE assets SET status='available' WHERE id=$1`, [asgn.asset_id]);
  await writeAudit({
    actorId: user.id, actorName,
    action: "Asset returned", targetType: "asset_assignment", targetId: id,
    detail: `${assetName} returned`, at: new Date().toISOString(),
  });
  const ownerR = await pool.query(`SELECT id FROM users WHERE employee_id=$1`, [asgn.employee_id]);
  if (ownerR.rows[0]) {
    await writeNotification({ userId: ownerR.rows[0].id, title: "Pengembalian Dikonfirmasi", body: `Pengembalian ${assetName} dikonfirmasi HR.`, type: "info", link: "/app/aset" });
  }

  return Response.json({ ok: true });
}
