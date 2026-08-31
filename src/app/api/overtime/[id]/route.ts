import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit, writeNotification } from "@/lib/server/state";

const ADMIN_ROLES = ["hr_admin", "hr_manager", "super_admin", "manager"];

/** PATCH /api/overtime/[id] — setujui/tolak */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const { approve } = (await req.json()) as { approve: boolean };

  if (!ADMIN_ROLES.includes(user.role)) {
    return Response.json({ ok: false, error: "Hanya atasan/admin." }, { status: 403 });
  }
  const r = await pool.query(
    `SELECT o.*, e.name emp_name FROM overtime_requests o JOIN employees e ON e.id = o.employee_id WHERE o.id = $1`,
    [id],
  );
  const ot = r.rows[0];
  if (!ot) return Response.json({ ok: false, error: "Tidak ditemukan." }, { status: 404 });
  if (ot.status !== "pending") return Response.json({ ok: false, error: "Sudah diputuskan." }, { status: 409 });

  const approverR = await pool.query(`SELECT name FROM employees WHERE id = $1`, [user.employee_id]);
  const approverName = approverR.rows[0]?.name ?? user.employee_id;

  const status = approve ? "approved" : "rejected";
  await pool.query(`UPDATE overtime_requests SET status=$1, decided_by=$2 WHERE id=$3`, [status, approverName, id]);
  await writeAudit({
    actorId: user.id, actorName: approverName,
    action: approve ? "Approved overtime" : "Rejected overtime",
    targetType: "overtime_request", targetId: id,
    detail: `${ot.emp_name}: ${ot.date} ${ot.start_time}–${ot.end_time} (${ot.hours} jam)`,
    before: "pending", after: status, at: new Date().toISOString(),
  });

  // Kirim notifikasi ke karyawan
  const userR = await pool.query(`SELECT id FROM users WHERE employee_id = $1`, [ot.employee_id]);
  if (userR.rows[0]) {
    await writeNotification({
      userId: userR.rows[0].id,
      title: approve ? "Pengajuan Lembur Disetujui" : "Pengajuan Lembur Ditolak",
      body: `Pengajuan lembur Anda tanggal ${ot.date} (${ot.hours} jam) telah ${approve ? 'disetujui' : 'ditolak'} oleh ${approverName}.`,
      type: "info",
      link: "/app",
    });
  }

  return Response.json({ ok: true, status });
}
