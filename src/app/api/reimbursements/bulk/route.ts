import { pool } from "@/db/client";
import { isHr } from "@/lib/roles";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit, writeNotification } from "@/lib/server/state";

export async function POST(req: Request) {
  const u = await getSessionUser();
  if (!u) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(u.role)) return Response.json({ ok: false, error: "Hanya HR yang dapat memproses reimbursement." }, { status: 403 });

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
      const r = await client.query(`SELECT * FROM reimbursements WHERE id=$1 FOR UPDATE`, [id]);
      if (r.rows.length === 0) continue;
      const ex = r.rows[0];
      if (ex.status === "approved" || ex.status === "rejected") continue;
      if (ex.employee_id === u.employee_id) continue;
      if (u.role === "hr") {
        const br = await client.query(
          `SELECT branch_id FROM employees WHERE id = $1 OR id = $2`,
          [u.employee_id, ex.employee_id],
        );
        const branches = new Set(br.rows.map((x) => x.branch_id as string | null).filter(Boolean));
        if (branches.size !== 1) continue;
      }

      const approvals = (ex.approvals ?? []) as { level: string; byName: string; at: string; approved: boolean }[];
      const updated = [...approvals, { level: "hr", byName: approver, at: new Date().toISOString(), approved: approve }];
      const newStatus = approve ? "approved" : "rejected";
      await client.query(`UPDATE reimbursements SET status=$1, approvals=$2 WHERE id=$3`, [newStatus, JSON.stringify(updated), id]);
      await writeAudit({ actorId: u.id, actorName: approver, action: approve ? "Reimbursement approved" : "Reimbursement rejected", targetType: "reimbursement", targetId: id, detail: `${ex.category} ${ex.amount}`, after: newStatus, at: new Date().toISOString() });

      const ur = await client.query(`SELECT id FROM users WHERE employee_id=$1`, [ex.employee_id]);
      if (ur.rows[0]) await writeNotification({ userId: ur.rows[0].id, title: approve ? "Reimburse Disetujui" : "Reimburse Ditolak", body: `Reimburse ${ex.category} ${approve ? "disetujui" : "ditolak"} oleh HR (${approver})`, type: "info", link: "/app/reimbursements" });
    }
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  return Response.json({ ok: true });
}
