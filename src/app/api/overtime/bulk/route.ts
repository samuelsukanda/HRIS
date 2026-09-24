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
        `SELECT o.*, e.spv_id, e.manager_id FROM overtime_requests o
         JOIN employees e ON e.id = o.employee_id WHERE o.id=$1 AND o.status IN ('pending','spv_approved')`,
        [id],
      );
      if (r.rows.length === 0) continue;
      const ot = r.rows[0];

      if (ot.spv_id && u.employee_id === ot.spv_id && ot.status === "pending") {
        const newStatus = approve ? "spv_approved" : "rejected";
        await client.query(`UPDATE overtime_requests SET status=$1, decided_by=$2 WHERE id=$3`, [newStatus, approver, id]);
        await writeAudit({ actorId: u.id, actorName: approver, action: "SPV approved overtime", targetType: "overtime_request", targetId: id, detail: newStatus, before: "pending", after: newStatus, at: new Date().toISOString() });
        const ur = await client.query(`SELECT id FROM users WHERE employee_id=$1`, [ot.employee_id]);
        if (ur.rows[0]) await writeNotification({ userId: ur.rows[0].id, title: approve ? "Lembur Disetujui SPV" : "Lembur Ditolak SPV", body: `Lembur ${approve ? "disetujui" : "ditolak"} oleh SPV`, type: "info", link: "/app/lembur" });
        if (approve && ot.manager_id) {
          const mu = await client.query(`SELECT id FROM users WHERE employee_id=$1`, [ot.manager_id]);
          if (mu.rows[0]) await writeNotification({ userId: mu.rows[0].id, title: "Lembur Perlu Persetujuan Manager", body: `Pengajuan lembur menunggu persetujuan Anda`, type: "approval", link: "/admin/lembur" });
        }
      }
      // Tahap 2: Manager (dari pending hanya jika tanpa SPV, atau dari spv_approved)
      else if (ot.manager_id && u.employee_id === ot.manager_id && (ot.status === "spv_approved" || (ot.status === "pending" && !ot.spv_id))) {
        const newStatus = approve ? "approved" : "rejected";
        await client.query(`UPDATE overtime_requests SET status=$1, decided_by=$2 WHERE id=$3`, [newStatus, approver, id]);
        await writeAudit({ actorId: u.id, actorName: approver, action: "Manager approved overtime", targetType: "overtime_request", targetId: id, detail: newStatus, before: "spv_approved", after: newStatus, at: new Date().toISOString() });
        const ur = await client.query(`SELECT id FROM users WHERE employee_id=$1`, [ot.employee_id]);
        if (ur.rows[0]) await writeNotification({ userId: ur.rows[0].id, title: approve ? "Lembur Disetujui" : "Lembur Ditolak Manager", body: `Lembur ${approve ? "disetujui" : "ditolak"} oleh Manager`, type: "info", link: "/app/lembur" });
      }
    }
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  return Response.json({ ok: true });
}
