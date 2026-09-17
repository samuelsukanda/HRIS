import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit, writeNotification } from "@/lib/server/state";

/** PATCH /api/shift-swaps/[id] — 2 tahap: SPV → Manager */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getSessionUser();
  if (!u) return Response.json({ ok: false }, { status: 401 });
  const { id } = await params;
  const { approve } = await req.json() as { approve: boolean };

  const r = await pool.query(
    `SELECT s.*, e.name emp_name, e.spv_id, e.manager_id
     FROM shift_swaps s JOIN employees e ON e.id = s.employee_id WHERE s.id = $1`,
    [id],
  );
  if (!r.rows.length) return Response.json({ ok: false }, { status: 404 });
  const sw = r.rows[0];

  const approver = (await pool.query(`SELECT name FROM employees WHERE id=$1`, [u.employee_id])).rows[0]?.name ?? u.employee_id;

  // Tahap 1: SPV
  if (sw.spv_id && u.employee_id === sw.spv_id) {
    if (sw.status !== "pending") return Response.json({ ok: false, error: "Sudah diproses." }, { status: 409 });
    const newStatus = approve ? "spv_approved" : "rejected";
    await pool.query(`UPDATE shift_swaps SET status=$1, decided_by=$2 WHERE id=$3`, [newStatus, approver, id]);
    await writeAudit({ actorId: u.id, actorName: approver, action: approve ? "SPV approved shift swap" : "SPV rejected shift swap", targetType: "shift_swap", targetId: id, detail: `${sw.emp_name}: ${sw.date}`, before: "pending", after: newStatus, at: new Date().toISOString() });
    const userR = await pool.query(`SELECT id FROM users WHERE employee_id=$1`, [sw.employee_id]);
    if (userR.rows[0]) await writeNotification({ userId: userR.rows[0].id, title: approve ? "Tukar Shift Disetujui SPV" : "Tukar Shift Ditolak SPV", body: `Permintaan tukar shift ${sw.date} ${approve ? "disetujui" : "ditolak"} oleh SPV.`, type: "info", link: "/app/jadwal" });
    if (approve && sw.manager_id) {
      const mu = await pool.query(`SELECT id FROM users WHERE employee_id=$1`, [sw.manager_id]);
      if (mu.rows[0]) await writeNotification({ userId: mu.rows[0].id, title: "Tukar Shift Perlu Persetujuan Manager", body: `Tukar shift ${sw.emp_name} ${sw.date} menunggu persetujuan Anda.`, type: "approval", link: "/admin/jadwal" });
    }
    return Response.json({ ok: true });
  }

  // Tahap 2: Manager (bisa dari pending jika tidak ada SPV, atau dari spv_approved)
  if (sw.manager_id && u.employee_id === sw.manager_id) {
    if (sw.status !== "spv_approved" && sw.status !== "pending") return Response.json({ ok: false, error: "Sudah diproses." }, { status: 409 });
    const newStatus = approve ? "approved" : "rejected";
    await pool.query(`UPDATE shift_swaps SET status=$1, decided_by=$2 WHERE id=$3`, [newStatus, approver, id]);
    if (approve) {
      await pool.query(`INSERT INTO roster (employee_id,date,shift_id) VALUES ($1,$2,$3) ON CONFLICT (employee_id,date) DO UPDATE SET shift_id=EXCLUDED.shift_id`,
        [sw.employee_id, sw.date, sw.target_shift_id]);
    }
    await writeAudit({ actorId: u.id, actorName: approver, action: approve ? "Manager approved shift swap" : "Manager rejected shift swap", targetType: "shift_swap", targetId: id, detail: `${sw.emp_name}: ${sw.date}`, before: "spv_approved", after: newStatus, at: new Date().toISOString() });
    const userR = await pool.query(`SELECT id FROM users WHERE employee_id=$1`, [sw.employee_id]);
    if (userR.rows[0]) await writeNotification({ userId: userR.rows[0].id, title: approve ? "Tukar Shift Disetujui" : "Tukar Shift Ditolak Manager", body: `Permintaan tukar shift ${sw.date} ${approve ? "disetujui" : "ditolak"} oleh Manager.`, type: "info", link: "/app/jadwal" });
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "Anda bukan atasan pengajuan ini." }, { status: 403 });
}
