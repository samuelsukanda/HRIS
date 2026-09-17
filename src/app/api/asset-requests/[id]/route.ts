import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit, writeNotification } from "@/lib/server/state";

/** PATCH /api/asset-requests/[id] — 2 tahap: SPV → Manager */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getSessionUser();
  if (!u) return Response.json({ ok: false }, { status: 401 });
  const { id } = await params;
  const { approve } = await req.json() as { approve: boolean };

  const r = await pool.query(
    `SELECT ar.*, e.name emp_name, e.spv_id, e.manager_id
     FROM asset_requests ar JOIN employees e ON e.id = ar.employee_id WHERE ar.id = $1`,
    [id],
  );
  if (!r.rows.length) return Response.json({ ok: false }, { status: 404 });
  const req0 = r.rows[0];

  const approver = (await pool.query(`SELECT name FROM employees WHERE id=$1`, [u.employee_id])).rows[0]?.name ?? u.employee_id;

  // Tahap 1: SPV
  if (req0.spv_id && u.employee_id === req0.spv_id) {
    if (req0.status !== "pending") return Response.json({ ok: false, error: "Sudah diproses." }, { status: 409 });
    const newStatus = approve ? "spv_approved" : "rejected";
    await pool.query(`UPDATE asset_requests SET status=$1, decided_by=$2 WHERE id=$3`, [newStatus, approver, id]);
    await writeAudit({ actorId: u.id, actorName: approver, action: approve ? "SPV approved asset request" : "SPV rejected asset request", targetType: "asset_request", targetId: id, detail: req0.category, before: "pending", after: newStatus, at: new Date().toISOString() });
    const userR = await pool.query(`SELECT id FROM users WHERE employee_id=$1`, [req0.employee_id]);
    if (userR.rows[0]) await writeNotification({ userId: userR.rows[0].id, title: approve ? "Permintaan Aset Disetujui SPV" : "Permintaan Aset Ditolak SPV", body: `Permintaan aset ${req0.category} ${approve ? "disetujui" : "ditolak"} oleh SPV.`, type: "info", link: "/app/aset" });
    if (approve && req0.manager_id) {
      const mu = await pool.query(`SELECT id FROM users WHERE employee_id=$1`, [req0.manager_id]);
      if (mu.rows[0]) await writeNotification({ userId: mu.rows[0].id, title: "Permintaan Aset Perlu Persetujuan Manager", body: `Permintaan aset ${req0.category} dari ${req0.emp_name} menunggu persetujuan Anda.`, type: "approval", link: "/admin/aset" });
    }
    return Response.json({ ok: true });
  }

  // Tahap 2: Manager (bisa dari pending jika tidak ada SPV, atau dari spv_approved)
  if (req0.manager_id && u.employee_id === req0.manager_id) {
    if (req0.status !== "spv_approved" && req0.status !== "pending") return Response.json({ ok: false, error: "Sudah diproses." }, { status: 409 });
    const newStatus = approve ? "approved" : "rejected";
    await pool.query(`UPDATE asset_requests SET status=$1, decided_by=$2 WHERE id=$3`, [newStatus, approver, id]);
    await writeAudit({ actorId: u.id, actorName: approver, action: approve ? "Manager approved asset request" : "Manager rejected asset request", targetType: "asset_request", targetId: id, detail: req0.category, before: "spv_approved", after: newStatus, at: new Date().toISOString() });
    const userR = await pool.query(`SELECT id FROM users WHERE employee_id=$1`, [req0.employee_id]);
    if (userR.rows[0]) await writeNotification({ userId: userR.rows[0].id, title: approve ? "Permintaan Aset Disetujui" : "Permintaan Aset Ditolak Manager", body: `Permintaan aset ${req0.category} ${approve ? "disetujui" : "ditolak"} oleh Manager.`, type: "info", link: "/app/aset" });
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "Anda bukan atasan pengajuan ini." }, { status: 403 });
}
