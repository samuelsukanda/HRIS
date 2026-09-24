import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit, writeNotification } from "@/lib/server/state";
import { isHr } from "@/lib/roles";

/** PATCH /api/asset-requests/[id] — keputusan tunggal oleh HR */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getSessionUser();
  if (!u) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(u.role)) return Response.json({ ok: false, error: "Hanya HR yang dapat memutuskan permintaan aset." }, { status: 403 });
  const { id } = await params;
  const { approve } = await req.json() as { approve: boolean };

  const r = await pool.query(
    `SELECT ar.*, e.name emp_name
     FROM asset_requests ar JOIN employees e ON e.id = ar.employee_id WHERE ar.id = $1`,
    [id],
  );
  if (!r.rows.length) return Response.json({ ok: false }, { status: 404 });
  const req0 = r.rows[0];
  if (req0.status !== "pending" && req0.status !== "spv_approved") {
    return Response.json({ ok: false, error: "Sudah diproses." }, { status: 409 });
  }

  const approver = (await pool.query(`SELECT name FROM employees WHERE id=$1`, [u.employee_id])).rows[0]?.name ?? u.employee_id;

  const newStatus = approve ? "approved" : "rejected";
  await pool.query(`UPDATE asset_requests SET status=$1, decided_by=$2 WHERE id=$3`, [newStatus, approver, id]);
  await writeAudit({ actorId: u.id, actorName: approver, action: approve ? "Asset request approved" : "Asset request rejected", targetType: "asset_request", targetId: id, detail: req0.category, before: req0.status, after: newStatus, at: new Date().toISOString() });
  const userR = await pool.query(`SELECT id FROM users WHERE employee_id=$1`, [req0.employee_id]);
  if (userR.rows[0]) await writeNotification({ userId: userR.rows[0].id, title: approve ? "Permintaan Aset Disetujui" : "Permintaan Aset Ditolak", body: `Permintaan aset ${req0.category} ${approve ? "disetujui" : "ditolak"} oleh HR.`, type: "info", link: "/app/aset" });
  return Response.json({ ok: true });
}
