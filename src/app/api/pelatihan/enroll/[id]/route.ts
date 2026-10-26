import { pool } from "@/db/client";
import { writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const { id } = await params;
  const r = await pool.query(
    `SELECT te.*, e.branch_id AS "branchId"
     FROM training_enrollments te JOIN employees e ON e.id = te.employee_id WHERE te.id=$1`,
    [id],
  );
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });

  const enr = r.rows[0];
  if (enr.employee_id !== user.employee_id && !["hr", "super_admin"].includes(user.role)) {
    return Response.json({ ok: false }, { status: 403 });
  }
  if (user.role === "hr" && enr.employee_id !== user.employee_id && (enr.branchId ?? enr.branch_id) !== user.branch_id) {
    return Response.json({ ok: false, error: "Enrollment ini bukan dari cabang Anda." }, { status: 403 });
  }

  await pool.query(`UPDATE training_enrollments SET status='cancelled' WHERE id=$1`, [id]);

  await writeAudit({
    actorId: user.id, actorName: user.name,
    action: "Training enrollment cancelled", targetType: "training_enrollment", targetId: id,
    detail: `Enrollment ${enr.training_id} cancelled`, at: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
