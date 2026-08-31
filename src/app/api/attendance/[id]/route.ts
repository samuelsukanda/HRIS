import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { nextId, writeAudit } from "@/lib/server/state";
import type { Correction } from "@/lib/types";

/** PATCH /api/attendance/[id]
 * - {action:"decide", correctionId, approve} → keputusan koreksi (admin)
 * - {action:"edit_time", checkInAt?, checkOutAt?} → admin ubah jam langsung
 * - {correction:{reason,beforeCheckIn?,afterCheckIn?}} → karyawan ajukan koreksi
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json();

  const recR = await pool.query(`SELECT a.*, e.name emp_name FROM attendance a JOIN employees e ON e.id = a.employee_id WHERE a.id = $1`, [id]);
  const rec = recR.rows[0];
  if (!rec) return Response.json({ ok: false, error: "Rekaman tidak ditemukan." }, { status: 404 });

  const corrections: Correction[] = rec.corrections ?? [];
  const isAdmin = ["hr_admin", "hr_manager", "super_admin", "manager"].includes(user.role);

  // Karyawan ajukan koreksi
  if (body.correction) {
    if (!isAdmin && rec.employee_id !== user.employee_id) return Response.json({ ok: false }, { status: 403 });
    const newCorr: Correction = {
      id: `COR-${String(corrections.length + 1).padStart(3, "0")}`,
      requestedAt: new Date().toISOString(),
      reason: body.correction.reason,
      beforeCheckIn: body.correction.beforeCheckIn,
      afterCheckIn: body.correction.afterCheckIn,
      status: "pending",
      byEmployeeId: rec.employee_id,
    };
    corrections.push(newCorr);
    await pool.query(`UPDATE attendance SET corrections = $1 WHERE id = $2`, [JSON.stringify(corrections), id]);
    await writeAudit({
      actorId: user.id, actorName: rec.emp_name, action: "Correction requested",
      targetType: "attendance", targetId: id,
      detail: `Koreksi ${newCorr.afterCheckIn ?? "-"} — ${newCorr.reason}`, at: new Date().toISOString(),
    });
    return Response.json({ ok: true, corrections });
  }

  // Keputusan koreksi / edit langsung — hanya admin
  if (!isAdmin) return Response.json({ ok: false, error: "Hanya admin." }, { status: 403 });

  if (body.action === "decide") {
    const corr = corrections.find((c) => c.id === body.correctionId);
    if (!corr) return Response.json({ ok: false, error: "Koreksi tidak ada." }, { status: 404 });
    corr.status = body.approve ? "approved" : "rejected";
    corr.decidedBy = rec.emp_name;
    if (body.approve && corr.afterCheckIn) {
      await pool.query(`UPDATE attendance SET check_in_at = $1 WHERE id = $2`, [new Date(corr.afterCheckIn), id]);
    }
    await pool.query(`UPDATE attendance SET corrections = $1 WHERE id = $2`, [JSON.stringify(corrections), id]);
    await writeAudit({
      actorId: user.id, actorName: rec.emp_name,
      action: body.approve ? "Correction approved" : "Correction rejected",
      targetType: "attendance", targetId: id,
      detail: `${corr.id}: ${corr.reason}`,
      before: corr.beforeCheckIn, after: corr.afterCheckIn, at: new Date().toISOString(),
    });
    return Response.json({ ok: true, corrections });
  }

  if (body.action === "edit_time") {
    const before = `in ${rec.check_in_at ?? "-"} / out ${rec.check_out_at ?? "-"}`;
    if (body.checkInAt) await pool.query(`UPDATE attendance SET check_in_at = $1 WHERE id = $2`, [new Date(body.checkInAt), id]);
    if (body.checkOutAt) await pool.query(`UPDATE attendance SET check_out_at = $1 WHERE id = $2`, [new Date(body.checkOutAt), id]);
    const after = `in ${body.checkInAt ?? rec.check_in_at ?? "-"} / out ${body.checkOutAt ?? rec.check_out_at ?? "-"}`;
    await writeAudit({
      actorId: user.id, actorName: rec.emp_name, action: "Attendance time corrected",
      targetType: "attendance", targetId: id, detail: `Koreksi manual oleh ${user.email}`,
      before, after, at: new Date().toISOString(),
    });
    return Response.json({ ok: true });
  }

  void nextId; // reserved
  return Response.json({ ok: false, error: "Aksi tidak dikenal." }, { status: 400 });
}
