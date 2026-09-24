import { pool } from "@/db/client";
import { creatorBranchId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

import { isHr } from "@/lib/roles";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { status, notes } = body as { status: string; notes?: string };

  if (!status) return Response.json({ ok: false, error: "Status wajib diisi." }, { status: 400 });

  const r = await pool.query(
    `SELECT c.*, d.branch_id FROM candidates c
     JOIN job_postings j ON j.id = c.job_posting_id
     LEFT JOIN departments d ON d.id = j.department_id
     WHERE c.id=$1`,
    [id],
  );
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  if (user.role === "hr") {
    const myBranch = await creatorBranchId(user.employee_id);
    if (myBranch && r.rows[0].branch_id && r.rows[0].branch_id !== myBranch) {
      return Response.json({ ok: false, error: "Pelamar milik cabang lain." }, { status: 403 });
    }
  }

  const old = r.rows[0];
  await pool.query(
    `UPDATE candidates SET status=$1, notes=COALESCE($2, notes) WHERE id=$3`,
    [status, notes ?? null, id],
  );

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({
    actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id,
    action: "Candidate status updated", targetType: "candidate", targetId: id,
    detail: `${old.name}: ${old.status} → ${status}`,
    before: old.status, after: status, at: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
