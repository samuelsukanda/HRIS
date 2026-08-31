import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit, writeNotification } from "@/lib/server/state";

const ADMIN_ROLES = ["hr_admin", "hr_manager", "super_admin", "manager"];

/** PATCH /api/leave/[id] — setujui/tolak atau batal */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const { approve, cancel } = (await req.json()) as { approve?: boolean; cancel?: boolean };

  const r = await pool.query(
    `SELECT l.*, e.name emp_name FROM leave_requests l JOIN employees e ON e.id = l.employee_id WHERE l.id = $1`,
    [id],
  );
  const req0 = r.rows[0];
  if (!req0) return Response.json({ ok: false, error: "Tidak ditemukan." }, { status: 404 });

  // Pilihan 1: Batal oleh karyawan pembuat pengajuan
  if (cancel) {
    if (user.employee_id !== req0.employee_id) {
      return Response.json({ ok: false, error: "Hanya dapat membatalkan pengajuan sendiri." }, { status: 403 });
    }
    if (req0.status !== "pending") {
      return Response.json({ ok: false, error: "Hanya pengajuan pending yang dapat dibatalkan." }, { status: 409 });
    }
    await pool.query(`UPDATE leave_requests SET status='cancelled' WHERE id=$1`, [id]);
    await writeAudit({
      actorId: user.id, actorName: req0.emp_name,
      action: "Cancelled leave", targetType: "leave_request", targetId: id,
      detail: `${req0.start_date} s.d. ${req0.end_date} (${req0.days} hari)`,
      before: "pending", after: "cancelled", at: new Date().toISOString(),
    });
    return Response.json({ ok: true, status: "cancelled" });
  }

  // Pilihan 2: Keputusan oleh Admin/Manager
  if (!ADMIN_ROLES.includes(user.role)) {
    return Response.json({ ok: false, error: "Hanya atasan/admin." }, { status: 403 });
  }
  if (req0.status !== "pending") return Response.json({ ok: false, error: "Sudah diputuskan." }, { status: 409 });

  const approverR = await pool.query(`SELECT name FROM employees WHERE id = $1`, [user.employee_id]);
  const approverName = approverR.rows[0]?.name ?? user.employee_id;

  const status = approve ? "approved" : "rejected";
  await pool.query(`UPDATE leave_requests SET status=$1, decided_by=$2, decided_at=$3 WHERE id=$4`, [
    status, approverName, new Date(), id,
  ]);
  await writeAudit({
    actorId: user.id, actorName: approverName,
    action: approve ? "Approved leave" : "Rejected leave",
    targetType: "leave_request", targetId: id,
    detail: `${req0.emp_name}: ${req0.start_date} s.d. ${req0.end_date} (${req0.days} hari)`,
    before: "pending", after: status, at: new Date().toISOString(),
  });

  // Kirim notifikasi ke karyawan
  const userR = await pool.query(`SELECT id FROM users WHERE employee_id = $1`, [req0.employee_id]);
  if (userR.rows[0]) {
    await writeNotification({
      userId: userR.rows[0].id,
      title: approve ? "Pengajuan Cuti Disetujui" : "Pengajuan Cuti Ditolak",
      body: `Pengajuan cuti Anda tanggal ${req0.start_date} s.d. ${req0.end_date} telah ${approve ? 'disetujui' : 'ditolak'} oleh ${approverName}.`,
      type: "info",
      link: "/app/cuti",
    });
  }

  return Response.json({ ok: true, status });
}
