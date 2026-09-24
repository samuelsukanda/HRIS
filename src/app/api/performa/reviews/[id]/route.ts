import { pool } from "@/db/client";
import { creatorBranchId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

import { isHr } from "@/lib/roles";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });

  const { id } = await params;
  const r = await pool.query(
    `SELECT pr.*, e.branch_id FROM performance_reviews pr
     JOIN employees e ON e.id = pr.employee_id
     WHERE pr.id=$1`,
    [id],
  );
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  if (user.role === "hr") {
    const myBranch = await creatorBranchId(user.employee_id);
    if (myBranch && r.rows[0].branch_id && r.rows[0].branch_id !== myBranch) {
      return Response.json({ ok: false, error: "Review milik cabang lain." }, { status: 403 });
    }
  }

  await pool.query(`UPDATE performance_reviews SET status='final' WHERE id=$1`, [id]);

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({
    actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id,
    action: "Performance review finalized", targetType: "performance_review", targetId: id,
    detail: `Review ${r.rows[0].period} finalized`, after: "final", at: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
