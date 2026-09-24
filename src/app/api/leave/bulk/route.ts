import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit, writeNotification } from "@/lib/server/state";

export async function POST(req: Request) {
  const u = await getSessionUser();
  if (!u) return Response.json({ ok: false }, { status: 401 });
  const { ids, approve } = await req.json() as { ids: string[]; approve: boolean };
  if (!ids?.length) return Response.json({ ok: false }, { status: 400 });

  const approver = (await pool.query(`SELECT name FROM employees WHERE id=$1`, [u.employee_id])).rows[0]?.name ?? u.employee_id;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const id of ids) {
      const r = await client.query(
        `SELECT l.*, e.spv_id, e.manager_id FROM leave_requests l
         JOIN employees e ON e.id = l.employee_id WHERE l.id=$1 AND l.status IN ('pending','spv_approved')`,
        [id],
      );
      if (r.rows.length === 0) continue;
      const req0 = r.rows[0];

      // Tahap 1: SPV
      if (req0.spv_id && u.employee_id === req0.spv_id && req0.status === "pending") {
        const newStatus = approve ? "spv_approved" : "rejected";
        await client.query(`UPDATE leave_requests SET status=$1, decided_by=$2, decided_at=NOW() WHERE id=$3`, [newStatus, approver, id]);
        await writeAudit({ actorId: u.id, actorName: approver, action: "SPV approved leave", targetType: "leave_request", targetId: id, detail: newStatus, before: "pending", after: newStatus, at: new Date().toISOString() });
        const ur = await client.query(`SELECT id FROM users WHERE employee_id=$1`, [req0.employee_id]);
        if (ur.rows[0]) await writeNotification({ userId: ur.rows[0].id, title: approve ? "Cuti Disetujui SPV" : "Cuti Ditolak SPV", body: `Pengajuan cuti ${approve ? "disetujui" : "ditolak"} oleh SPV`, type: "info", link: "/app/cuti" });
        if (approve && req0.manager_id) {
          const mu = await client.query(`SELECT id FROM users WHERE employee_id=$1`, [req0.manager_id]);
          if (mu.rows[0]) await writeNotification({ userId: mu.rows[0].id, title: "Cuti Perlu Persetujuan Manager", body: `Pengajuan cuti menunggu persetujuan Anda`, type: "approval", link: "/admin/cuti" });
        }
      }
      // Tahap 2: Manager (dari pending hanya jika tanpa SPV, atau dari spv_approved)
      else if (req0.manager_id && u.employee_id === req0.manager_id && (req0.status === "spv_approved" || (req0.status === "pending" && !req0.spv_id))) {
        const newStatus = approve ? "approved" : "rejected";
        await client.query(`UPDATE leave_requests SET status=$1, decided_by=$2, decided_at=NOW() WHERE id=$3`, [newStatus, approver, id]);
        await writeAudit({ actorId: u.id, actorName: approver, action: "Manager approved leave", targetType: "leave_request", targetId: id, detail: newStatus, before: "spv_approved", after: newStatus, at: new Date().toISOString() });
        const ur = await client.query(`SELECT id FROM users WHERE employee_id=$1`, [req0.employee_id]);
        if (ur.rows[0]) await writeNotification({ userId: ur.rows[0].id, title: approve ? "Cuti Disetujui" : "Cuti Ditolak Manager", body: `Pengajuan cuti ${approve ? "disetujui" : "ditolak"} oleh Manager`, type: "info", link: "/app/cuti" });
      }
    }
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  return Response.json({ ok: true });
}
