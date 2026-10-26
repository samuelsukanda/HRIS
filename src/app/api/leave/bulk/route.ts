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
        `SELECT l.*, e.spv_id, e.manager_id, e.branch_id FROM leave_requests l
         JOIN employees e ON e.id = l.employee_id WHERE l.id=$1 AND l.status IN ('pending','spv_approved') FOR UPDATE`,
        [id],
      );
      if (r.rows.length === 0) continue;
       const req0 = r.rows[0];
       if (req0.employee_id === u.employee_id) continue;
       const actor = { id: u.id, employeeId: u.employee_id, role: u.role, branchId: u.branch_id };
       const target = { id: req0.employee_id, branchId: req0.branch_id, spvId: req0.spv_id, managerId: req0.manager_id };
       const canSupervisorApprove = canApproveEmployee(actor, target, "supervisor");
       const canManagerApprove = canApproveEmployee(actor, target, "manager");
       if (!canSupervisorApprove && !canManagerApprove) continue;

       // Tahap 1: SPV
      if (canSupervisorApprove && req0.status === "pending" && Boolean(req0.spv_id)) {
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
      else if (canManagerApprove && (req0.status === "spv_approved" || (req0.status === "pending" && !req0.spv_id))) {
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
