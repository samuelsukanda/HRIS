import { pool } from "@/db/client";
import { writeAudit, writeNotification } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const { id } = await params;
  const r = await pool.query(
    `SELECT a.*, e.manager_id FROM asset_assignments a
     JOIN employees e ON e.id = a.employee_id WHERE a.id = $1`,
    [id],
  );
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });

  const asgn = r.rows[0];
  if (asgn.returned_at) return Response.json({ ok: false, error: "Sudah dikembalikan." }, { status: 409 });

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  const actorName = empR.rows[0]?.name ?? user.employee_id;
  const assetR = await pool.query(`SELECT name FROM assets WHERE id=$1`, [asgn.asset_id]);
  const assetName = assetR.rows[0]?.name ?? asgn.asset_id;

  // Karyawan: ajukan pengembalian
  if (asgn.employee_id === user.employee_id) {
    if (asgn.return_requested_at) return Response.json({ ok: false, error: "Sudah diajukan, menunggu Manager." }, { status: 409 });
    await pool.query(`UPDATE asset_assignments SET return_requested_at=NOW() WHERE id=$1`, [id]);
    await writeAudit({ actorId: user.id, actorName, action: "Asset return requested", targetType: "asset_assignment", targetId: id, detail: `${assetName} — menunggu konfirmasi Manager`, at: new Date().toISOString() });
    // Notifikasi ke Manager
    if (asgn.manager_id) {
      const mu = await pool.query(`SELECT id FROM users WHERE employee_id=$1 AND active=true`, [asgn.manager_id]);
      if (mu.rows[0]) await writeNotification({ userId: mu.rows[0].id, title: "Permintaan Pengembalian Aset", body: `${actorName} mengajukan pengembalian ${assetName}.`, type: "approval", link: "/admin/aset" });
    }
    return Response.json({ ok: true, requested: true });
  }

  // Manager: konfirmasi pengembalian
  if (asgn.manager_id && user.employee_id === asgn.manager_id) {
    await pool.query(`UPDATE asset_assignments SET returned_at=NOW(), return_requested_at=NULL WHERE id=$1`, [id]);
    await pool.query(`UPDATE assets SET status='available' WHERE id=$1`, [asgn.asset_id]);
    await writeAudit({ actorId: user.id, actorName, action: "Asset returned", targetType: "asset_assignment", targetId: id, detail: `${assetName} returned`, at: new Date().toISOString() });
    const ownerR = await pool.query(`SELECT id FROM users WHERE employee_id=$1`, [asgn.employee_id]);
    if (ownerR.rows[0]) await writeNotification({ userId: ownerR.rows[0].id, title: "Pengembalian Dikonfirmasi", body: `Pengembalian ${assetName} dikonfirmasi Manager.`, type: "info", link: "/app/aset" });
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "Anda bukan atasan aset ini." }, { status: 403 });
}
