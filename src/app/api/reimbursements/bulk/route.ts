import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit, writeNotification } from "@/lib/server/state";

export async function POST(req: Request) {
  const u = await getSessionUser();
  if (!u) return Response.json({ ok: false }, { status: 401 });
  const { ids, approve, level } = await req.json() as { ids: string[]; approve: boolean; level: "spv" | "manager" };
  if (!ids?.length || !level) return Response.json({ ok: false }, { status: 400 });

  const approver = (await pool.query(`SELECT name FROM employees WHERE id=$1`, [u.employee_id])).rows[0]?.name ?? u.employee_id;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const id of ids) {
      const r = await client.query(
        `SELECT rm.*, e.spv_id, e.manager_id FROM reimbursements rm
         JOIN employees e ON e.id = rm.employee_id WHERE rm.id=$1`,
        [id],
      );
      if (r.rows.length === 0) continue;
      const ex = r.rows[0];
      if (ex.status === "approved" || ex.status === "rejected") continue;

      // Validasi atasan
      if (level === "spv" && (ex.spv_id !== u.employee_id || ex.status !== "pending")) continue;
      if (level === "manager" && (ex.manager_id !== u.employee_id || (ex.status !== "spv_approved" && ex.status !== "pending"))) continue;

      const approvals = (ex.approvals ?? []) as any[];
      if (approvals.some((a: any) => a.level === level && a.approved)) continue;

      const updated = [...approvals, { level, byName: approver, at: new Date().toISOString(), approved: approve }];
      let newStatus = approve ? (level === "spv" ? "spv_approved" : "approved") : "rejected";
      await client.query(`UPDATE reimbursements SET status=$1, approvals=$2 WHERE id=$3`, [newStatus, JSON.stringify(updated), id]);
      await writeAudit({ actorId: u.id, actorName: approver, action: approve ? `Reimbursement ${level} approved` : `Reimbursement ${level} rejected`, targetType: "reimbursement", targetId: id, detail: `${ex.category} ${ex.amount}`, after: newStatus, at: new Date().toISOString() });

      const ur = await client.query(`SELECT id FROM users WHERE employee_id=$1`, [ex.employee_id]);
      if (ur.rows[0]) await writeNotification({ userId: ur.rows[0].id, title: approve ? "Reimburse Disetujui" : "Reimburse Ditolak", body: `Reimburse ${ex.category} ${approve ? "disetujui" : "ditolak"} oleh ${approver} (${level})`, type: "info", link: "/app/reimbursements" });

      if (newStatus === "spv_approved" && ex.manager_id) {
        const mu = await client.query(`SELECT id FROM users WHERE employee_id=$1`, [ex.manager_id]);
        if (mu.rows[0]) await writeNotification({ userId: mu.rows[0].id, title: "Reimbursement Perlu Persetujuan Manager", body: `Reimbursement ${ex.category} menunggu persetujuan Anda`, type: "approval", link: "/admin/reimbursements" });
      }
    }
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  return Response.json({ ok: true });
}
