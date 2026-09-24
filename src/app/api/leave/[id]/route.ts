import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit, writeNotification } from "@/lib/server/state";
import { fmtDateLongID } from "@/lib/format";

/** PATCH /api/leave/[id] — 2 tahap: SPV → Manager */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const { approve, cancel } = (await req.json()) as { approve?: boolean; cancel?: boolean };

  const r = await pool.query(
    `SELECT l.*, e.name emp_name, e.spv_id, e.manager_id
     FROM leave_requests l JOIN employees e ON e.id = l.employee_id WHERE l.id = $1`,
    [id],
  );
  const req0 = r.rows[0];
  if (!req0) return Response.json({ ok: false, error: "Tidak ditemukan." }, { status: 404 });

  // Batal oleh karyawan pembuat
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

  if (approve === undefined) return Response.json({ ok: false, error: "Parameter tidak valid." }, { status: 400 });

  const approverR = await pool.query(`SELECT name FROM employees WHERE id = $1`, [user.employee_id]);
  const approverName = approverR.rows[0]?.name ?? user.employee_id;

  // Tahap 1: SPV approve → spv_approved
  if (req0.spv_id && user.employee_id === req0.spv_id) {
    if (req0.status !== "pending") return Response.json({ ok: false, error: "Sudah diproses." }, { status: 409 });
    const newStatus = approve ? "spv_approved" : "rejected";
    await pool.query(`UPDATE leave_requests SET status=$1, decided_by=$2, decided_at=$3 WHERE id=$4`, [
      newStatus, approverName, new Date(), id,
    ]);
    await writeAudit({
      actorId: user.id, actorName: approverName,
      action: approve ? "SPV approved leave" : "SPV rejected leave",
      targetType: "leave_request", targetId: id,
      detail: `${req0.emp_name}: ${req0.start_date} s.d. ${req0.end_date} (${req0.days} hari)`,
      before: "pending", after: newStatus, at: new Date().toISOString(),
    });
    // Notifikasi ke karyawan
    const userR = await pool.query(`SELECT id FROM users WHERE employee_id = $1`, [req0.employee_id]);
    if (userR.rows[0]) {
      await writeNotification({
        userId: userR.rows[0].id,
        title: approve ? "Cuti Disetujui SPV" : "Cuti Ditolak SPV",
        body: `Pengajuan cuti Anda tanggal ${fmtDateLongID(req0.start_date)} s.d. ${fmtDateLongID(req0.end_date)} telah ${approve ? "disetujui" : "ditolak"} oleh SPV (${approverName}).`,
        type: "info", link: "/app/cuti",
      });
    }
    // Notifikasi ke Manager jika disetujui
    if (approve && req0.manager_id) {
      const mgrUserR = await pool.query(`SELECT id FROM users WHERE employee_id = $1`, [req0.manager_id]);
      if (mgrUserR.rows[0]) {
        await writeNotification({
          userId: mgrUserR.rows[0].id,
          title: "Cuti Perlu Persetujuan Manager",
          body: `Pengajuan cuti ${req0.emp_name} tanggal ${fmtDateLongID(req0.start_date)} s.d. ${fmtDateLongID(req0.end_date)} telah disetujui SPV dan menunggu persetujuan Anda.`,
          type: "approval", link: "/admin/cuti",
        });
      }
    }
    return Response.json({ ok: true, status: newStatus });
  }

  // Tahap 2: Manager (dari pending hanya jika tanpa SPV, atau dari spv_approved)
  if (req0.manager_id && user.employee_id === req0.manager_id) {
    if (req0.status === "pending" && req0.spv_id) {
      return Response.json({ ok: false, error: "Menunggu persetujuan SPV." }, { status: 409 });
    }
    if (req0.status !== "spv_approved" && req0.status !== "pending") return Response.json({ ok: false, error: "Sudah diproses." }, { status: 409 });
    const newStatus = approve ? "approved" : "rejected";
    await pool.query(`UPDATE leave_requests SET status=$1, decided_by=$2, decided_at=$3 WHERE id=$4`, [
      newStatus, approverName, new Date(), id,
    ]);
    await writeAudit({
      actorId: user.id, actorName: approverName,
      action: approve ? "Manager approved leave" : "Manager rejected leave",
      targetType: "leave_request", targetId: id,
      detail: `${req0.emp_name}: ${req0.start_date} s.d. ${req0.end_date} (${req0.days} hari)`,
      before: req0.status, after: newStatus, at: new Date().toISOString(),
    });
    // Notifikasi ke karyawan
    const userR = await pool.query(`SELECT id FROM users WHERE employee_id = $1`, [req0.employee_id]);
    if (userR.rows[0]) {
      await writeNotification({
        userId: userR.rows[0].id,
        title: approve ? "Cuti Disetujui" : "Cuti Ditolak Manager",
        body: `Pengajuan cuti Anda tanggal ${fmtDateLongID(req0.start_date)} s.d. ${fmtDateLongID(req0.end_date)} telah ${approve ? "disetujui" : "ditolak"} oleh Manager (${approverName}).`,
        type: "info", link: "/app/cuti",
      });
    }
    return Response.json({ ok: true, status: newStatus });
  }

  return Response.json({ ok: false, error: "Anda bukan atasan pengajuan ini." }, { status: 403 });
}
