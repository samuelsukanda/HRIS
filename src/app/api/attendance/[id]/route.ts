import { pool } from "@/db/client";
import { canManageEmployee } from "@/lib/server/access";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/state";
import type { Correction, Role } from "@/lib/types";

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

  const recR = await pool.query(
    `SELECT a.*, e.name emp_name, e.branch_id, e.spv_id, e.manager_id
     FROM attendance a JOIN employees e ON e.id = a.employee_id WHERE a.id = $1`,
    [id],
  );
  const rec = recR.rows[0];
  if (!rec) return Response.json({ ok: false, error: "Rekaman tidak ditemukan." }, { status: 404 });
  const canManage = canManageEmployee({ id: user.id, employeeId: user.employee_id, role: user.role as Role, branchId: user.branch_id }, {
    id: rec.employee_id,
    branchId: rec.branch_id,
    spvId: rec.spv_id,
    managerId: rec.manager_id,
  });
  const corrections: Correction[] = rec.corrections ?? [];
  const isAdmin = ["hr", "super_admin", "manager", "supervisor"].includes(user.role) && canManage;

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
    if (corr.byEmployeeId === user.employee_id) {
      return Response.json({ ok: false, error: "Tidak dapat memutuskan koreksi sendiri." }, { status: 403 });
    }
    const approve = body.approve === true;
    const approverName = user.name;
    corr.status = approve ? "approved" : "rejected";
    corr.decidedBy = approverName;
    const correctedCheckIn = approve && corr.afterCheckIn ? new Date(corr.afterCheckIn) : null;
    await pool.query(
      `UPDATE attendance
       SET check_in_at = CASE WHEN $1::timestamptz IS NOT NULL THEN $1 ELSE check_in_at END,
           verification_status = CASE WHEN $2 THEN 'valid' ELSE verification_status END,
           rejection_reason = CASE WHEN $2 THEN NULL ELSE rejection_reason END,
           status = CASE
             WHEN $2 AND status NOT IN ('present','late','early_leave','wfh','business_trip') THEN 'present'
             WHEN $2 AND $1::timestamptz IS NOT NULL AND status = 'late' THEN 'present'
             ELSE status
           END,
           corrections = $3
       WHERE id = $4`,
      [correctedCheckIn, approve, JSON.stringify(corrections), id],
    );
    await writeAudit({
      actorId: user.id, actorName: approverName,
      action: approve ? "Correction approved" : "Correction rejected",
      targetType: "attendance", targetId: id,
      detail: `${corr.id}: ${corr.reason}`,
      before: corr.beforeCheckIn, after: corr.afterCheckIn, at: new Date().toISOString(),
    });
    return Response.json({ ok: true, corrections });
  }

  if (body.action === "edit_time") {
    if (!body.checkInAt && !body.checkOutAt) {
      return Response.json({ ok: false, error: "Waktu masuk atau keluar wajib diisi." }, { status: 400 });
    }
    const checkInAt = body.checkInAt ? new Date(body.checkInAt) : null;
    const checkOutAt = body.checkOutAt ? new Date(body.checkOutAt) : null;
    if (Number.isNaN(checkInAt?.getTime() ?? 0) || Number.isNaN(checkOutAt?.getTime() ?? 0)) {
      return Response.json({ ok: false, error: "Waktu tidak valid." }, { status: 400 });
    }
    const before = `in ${rec.check_in_at ?? "-"} / out ${rec.check_out_at ?? "-"}`;
    await pool.query(
      `UPDATE attendance
       SET check_in_at = COALESCE($1::timestamptz, check_in_at),
           check_out_at = COALESCE($2::timestamptz, check_out_at),
           verification_status = 'valid',
           rejection_reason = NULL,
           status = CASE WHEN status NOT IN ('present','late','early_leave','wfh','business_trip') THEN 'present' ELSE status END
       WHERE id = $3`,
      [checkInAt, checkOutAt, id],
    );
    const after = `in ${body.checkInAt ?? rec.check_in_at ?? "-"} / out ${body.checkOutAt ?? rec.check_out_at ?? "-"}`;
    await writeAudit({
      actorId: user.id, actorName: user.name, action: "Attendance time corrected",
      targetType: "attendance", targetId: id, detail: `Koreksi manual oleh ${user.email}`,
      before, after, at: new Date().toISOString(),
    });
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "Aksi tidak dikenal." }, { status: 400 });
}
