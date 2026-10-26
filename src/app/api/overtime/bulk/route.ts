import { pool } from "@/db/client";
import { canApproveEmployee } from "@/lib/server/access";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit, writeNotification } from "@/lib/server/state";

export async function POST(req: Request) {
  const u = await getSessionUser();
  if (!u) return Response.json({ ok: false }, { status: 401 });
  const body = await req.json() as { ids?: unknown; approve?: unknown } | null;
  if (!body || !Array.isArray(body.ids) || body.ids.length === 0 || body.ids.some((id) => typeof id !== "string") || typeof body.approve !== "boolean") {
    return Response.json({ ok: false }, { status: 400 });
  }
  const ids = body.ids as string[];
  const approve = body.approve;

  const approver = u.name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const id of ids) {
      const r = await client.query(
        `SELECT o.*, e.spv_id, e.manager_id, e.branch_id FROM overtime_requests o
         JOIN employees e ON e.id = o.employee_id WHERE o.id=$1 AND o.status IN ('pending','spv_approved') FOR UPDATE`,
        [id],
      );
      if (r.rows.length === 0) continue;
       const ot = r.rows[0];
        if (ot.employee_id === u.employee_id) continue;
        const actor = { id: u.id, employeeId: u.employee_id, role: u.role, branchId: u.branch_id };
        const target = { id: ot.employee_id, branchId: ot.branch_id, spvId: ot.spv_id, managerId: ot.manager_id };
        const canSupervisorApprove = canApproveEmployee(actor, target, "supervisor");
        const canManagerApprove = canApproveEmployee(actor, target, "manager");
        if (!canSupervisorApprove && !canManagerApprove) continue;

       if (canSupervisorApprove && ot.status === "pending" && Boolean(ot.spv_id)) {

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
      else if (canManagerApprove && (ot.status === "spv_approved" || (ot.status === "pending" && !ot.spv_id))) {
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
