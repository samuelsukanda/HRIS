import { pool } from "@/db/client";
import { writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role)) return Response.json({ ok: false }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { status, notes } = body as { status: string; notes?: string };

  if (!status) return Response.json({ ok: false, error: "Status wajib diisi." }, { status: 400 });

  const r = await pool.query(`SELECT * FROM candidates WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });

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
