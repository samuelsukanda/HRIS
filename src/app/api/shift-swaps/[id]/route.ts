import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit, writeNotification } from "@/lib/server/state";

const HR = ["hr_manager","hr_admin","super_admin","manager"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getSessionUser(); if (!u) return Response.json({ ok: false }, { status: 401 });
  if (!HR.includes(u.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const { approve } = await req.json() as { approve: boolean };
  const r = await pool.query(`SELECT s.*, e.name emp_name FROM shift_swaps s JOIN employees e ON e.id=s.employee_id WHERE s.id=$1`, [id]);
  if (!r.rows.length) return Response.json({ ok: false }, { status: 404 });
  const sw = r.rows[0];
  if (sw.status !== "pending") return Response.json({ ok: false, error: "Sudah diputuskan." }, { status: 409 });
  const approver = (await pool.query(`SELECT name FROM employees WHERE id=$1`, [u.employee_id])).rows[0]?.name ?? u.employee_id;
  const status = approve ? "approved" : "rejected";
  await pool.query(`UPDATE shift_swaps SET status=$1, decided_by=$2 WHERE id=$3`, [status, approver, id]);
  if (approve) {
    // terapkan ke roster
    await pool.query(`INSERT INTO roster (employee_id,date,shift_id) VALUES ($1,$2,$3) ON CONFLICT (employee_id,date) DO UPDATE SET shift_id=EXCLUDED.shift_id`,
      [sw.employee_id, sw.date, sw.target_shift_id]);
  }
  await writeAudit({ actorId: u.id, actorName: approver, action: approve ? "Shift swap approved" : "Shift swap rejected", targetType: "shift_swap", targetId: id, detail: sw.emp_name, at: new Date().toISOString() });
  const userR = await pool.query(`SELECT id FROM users WHERE employee_id=$1`, [sw.employee_id]);
  if (userR.rows[0]) {
    await writeNotification({ userId: userR.rows[0].id, title: approve ? "Tukar Shift Disetujui" : "Tukar Shift Ditolak", body: `Permintaan tukar shift ${sw.date} ${approve ? "disetujui" : "ditolak"} oleh ${approver}.`, type: "info", link: "/app/jadwal" });
  }
  return Response.json({ ok: true });
}
