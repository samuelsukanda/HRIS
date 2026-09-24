import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit, writeNotification } from "@/lib/server/state";
import { fmtDateLongID } from "@/lib/format";

/** PATCH /api/overtime/[id] — 2 tahap: SPV → Manager */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json() as { approve?: boolean; cancel?: boolean };

  const r = await pool.query(
    `SELECT o.*, e.name emp_name, e.spv_id, e.manager_id
     FROM overtime_requests o JOIN employees e ON e.id = o.employee_id WHERE o.id = $1`,
    [id],
  );
  const ot = r.rows[0];
  if (!ot) return Response.json({ ok: false, error: "Tidak ditemukan." }, { status: 404 });

  // Cancel oleh karyawan sendiri
  if (body.cancel) {
    if (ot.employee_id !== user.employee_id) return Response.json({ ok: false, error: "Bukan milik Anda." }, { status: 403 });
    if (ot.status !== "pending") return Response.json({ ok: false, error: "Hanya bisa batalkan yang pending." }, { status: 409 });
    await pool.query(`UPDATE overtime_requests SET status='cancelled' WHERE id=$1`, [id]);
    await writeAudit({ actorId: user.id, actorName: ot.emp_name, action: "Overtime cancelled", targetType: "overtime_request", targetId: id, detail: `${ot.date} ${ot.hours} jam`, before: "pending", after: "cancelled", at: new Date().toISOString() });
    return Response.json({ ok: true, status: "cancelled" });
  }

  if (body.approve === undefined) return Response.json({ ok: false, error: "Parameter tidak valid." }, { status: 400 });

  const approverR = await pool.query(`SELECT name FROM employees WHERE id = $1`, [user.employee_id]);
  const approverName = approverR.rows[0]?.name ?? user.employee_id;

  // Tahap 1: SPV
  if (ot.spv_id && user.employee_id === ot.spv_id) {
    if (ot.status !== "pending") return Response.json({ ok: false, error: "Sudah diproses." }, { status: 409 });
    const newStatus = body.approve ? "spv_approved" : "rejected";
    await pool.query(`UPDATE overtime_requests SET status=$1, decided_by=$2 WHERE id=$3`, [newStatus, approverName, id]);
    await writeAudit({ actorId: user.id, actorName: approverName, action: body.approve ? "SPV approved overtime" : "SPV rejected overtime", targetType: "overtime_request", targetId: id, detail: `${ot.emp_name}: ${ot.date} ${ot.start_time}–${ot.end_time} (${ot.hours} jam)`, before: "pending", after: newStatus, at: new Date().toISOString() });
    const userR = await pool.query(`SELECT id FROM users WHERE employee_id = $1`, [ot.employee_id]);
    if (userR.rows[0]) await writeNotification({ userId: userR.rows[0].id, title: body.approve ? "Lembur Disetujui SPV" : "Lembur Ditolak SPV", body: `Pengajuan lembur Anda ${fmtDateLongID(ot.date)} (${ot.hours} jam) telah ${body.approve ? "disetujui" : "ditolak"} oleh SPV.`, type: "info", link: "/app/lembur" });
    if (body.approve && ot.manager_id) {
      const mu = await pool.query(`SELECT id FROM users WHERE employee_id = $1`, [ot.manager_id]);
      if (mu.rows[0]) await writeNotification({ userId: mu.rows[0].id, title: "Lembur Perlu Persetujuan Manager", body: `Pengajuan lembur ${ot.emp_name} ${fmtDateLongID(ot.date)} menunggu persetujuan Anda.`, type: "approval", link: "/admin/lembur" });
    }
    return Response.json({ ok: true, status: newStatus });
  }

  // Tahap 2: Manager (bisa dari pending jika tidak ada SPV, atau dari spv_approved)
  if (ot.manager_id && user.employee_id === ot.manager_id) {
    if (ot.status !== "spv_approved" && ot.status !== "pending") return Response.json({ ok: false, error: "Sudah diproses." }, { status: 409 });
    const newStatus = body.approve ? "approved" : "rejected";
    await pool.query(`UPDATE overtime_requests SET status=$1, decided_by=$2 WHERE id=$3`, [newStatus, approverName, id]);
    await writeAudit({ actorId: user.id, actorName: approverName, action: body.approve ? "Manager approved overtime" : "Manager rejected overtime", targetType: "overtime_request", targetId: id, detail: `${ot.emp_name}: ${ot.date} ${ot.start_time}–${ot.end_time} (${ot.hours} jam)`, before: ot.status, after: newStatus, at: new Date().toISOString() });
    const userR = await pool.query(`SELECT id FROM users WHERE employee_id = $1`, [ot.employee_id]);
    if (userR.rows[0]) await writeNotification({ userId: userR.rows[0].id, title: body.approve ? "Lembur Disetujui" : "Lembur Ditolak Manager", body: `Pengajuan lembur Anda ${fmtDateLongID(ot.date)} (${ot.hours} jam) telah ${body.approve ? "disetujui" : "ditolak"} oleh Manager.`, type: "info", link: "/app/lembur" });
    return Response.json({ ok: true, status: newStatus });
  }

  return Response.json({ ok: false, error: "Anda bukan atasan pengajuan ini." }, { status: 403 });
}
