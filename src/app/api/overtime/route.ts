import { pool } from "@/db/client";
import { canManageEmployee } from "@/lib/server/access";
import { getSessionUser } from "@/lib/server/session";
import { nextId, writeAudit, writeNotification } from "@/lib/server/state";
import { fmtDateLongID, isCalendarDate } from "@/lib/format";
import { isHr } from "@/lib/roles";

/** POST /api/overtime — ajukan lembur (boleh untuk diri sendiri / admin untuk karyawan) */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const b = (await req.json()) as { date: string; start: string; end: string; hours: number; reason: string; employeeId?: string };
  if (!isCalendarDate(b.date) || !/^\d{2}:\d{2}$/.test(b.start ?? "") || !/^\d{2}:\d{2}$/.test(b.end ?? "") || !b.reason?.trim()) {
    return Response.json({ ok: false, error: "Lengkapi formulir dengan tanggal/jam yang valid." }, { status: 400 });
  }
  const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const startMinutes = toMinutes(b.start);
  const endMinutes = toMinutes(b.end);
  if (startMinutes < 0 || startMinutes > 1439 || endMinutes < 0 || endMinutes > 1439) {
    return Response.json({ ok: false, error: "Jam lembur tidak valid." }, { status: 400 });
  }
  const duration = endMinutes > startMinutes ? endMinutes - startMinutes : endMinutes + 1440 - startMinutes;
  if (duration < 30 || duration > 720) {
    return Response.json({ ok: false, error: "Durasi lembur harus 30 menit sampai 12 jam." }, { status: 400 });
  }
  const hours = Math.round((duration / 60) * 100) / 100;

  const targetId = b.employeeId ?? user.employee_id;
  const targetResult = await pool.query(`SELECT id, branch_id, spv_id, manager_id FROM employees WHERE id=$1`, [targetId]);
  const targetEmployee = targetResult.rows[0];
  if (!targetEmployee) return Response.json({ ok: false, error: "Karyawan tidak ditemukan." }, { status: 404 });
  if (targetId !== user.employee_id && !canManageEmployee({ id: user.id, employeeId: user.employee_id, role: user.role, branchId: user.branch_id }, targetEmployee) && isHr(user.role)) {
    return Response.json({ ok: false, error: "Karyawan berada di luar cabang Anda." }, { status: 403 });
  }
  if (targetId !== user.employee_id && !isHr(user.role) && !canManageEmployee({ id: user.id, employeeId: user.employee_id, role: user.role, branchId: user.branch_id }, targetEmployee)) {
    return Response.json({ ok: false, error: "Bukan karyawan bawahan Anda." }, { status: 403 });
  }

  const activeRequests = await pool.query(
    `SELECT start_time, end_time FROM overtime_requests
     WHERE employee_id=$1 AND date=$2 AND status IN ('pending','spv_approved','approved')`,
    [targetId, b.date],
  );
  const endAt = startMinutes + duration;
  const overlaps = activeRequests.rows.some((row) => {
    const existingStart = toMinutes(row.start_time);
    const rawExistingEnd = toMinutes(row.end_time);
    if (!Number.isFinite(existingStart) || !Number.isFinite(rawExistingEnd)) return false;
    const existingEnd = rawExistingEnd > existingStart ? rawExistingEnd : rawExistingEnd + 1440;
    return startMinutes < existingEnd && endAt > existingStart;
  });
  if (overlaps) {
    return Response.json({ ok: false, error: "Jam lembur sudah tumpang tindih." }, { status: 409 });
  }

  const id = await nextId("overtime_requests", "OTR");
  await pool.query(
    `INSERT INTO overtime_requests (id,employee_id,date,start_time,end_time,hours,reason,status,submitted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8)`,
    [id, targetId, b.date, b.start, b.end, hours, b.reason.trim(), new Date()],
  );
  const empR = await pool.query(`SELECT name, spv_id, manager_id FROM employees WHERE id = $1`, [targetId]);
  const empName = empR.rows[0]?.name ?? "-";
  const spvId: string | null = empR.rows[0]?.spv_id ?? null;
  const managerId: string | null = empR.rows[0]?.manager_id ?? null;
  await writeAudit({
    actorId: user.id, actorName: empName,
    action: "Overtime requested", targetType: "overtime_request", targetId: id,
    detail: `${b.date} ${b.start}–${b.end} (${hours} jam)`, at: new Date().toISOString(),
  });

  // Notifikasi approval: SPV jika ada, jika tidak langsung ke Manager
  const approverEmpId = spvId ?? managerId;
  if (approverEmpId) {
    const approverUserR = await pool.query(`SELECT id FROM users WHERE employee_id = $1`, [approverEmpId]);
    if (approverUserR.rows[0]) {
      await writeNotification({
        userId: approverUserR.rows[0].id,
        title: "Pengajuan Lembur Baru",
        body: `${empName} mengajukan lembur ${fmtDateLongID(b.date)} (${hours} jam). Menunggu persetujuan Anda.`,
        type: "approval",
        link: "/admin/lembur",
      });
    }
  }

  return Response.json({ ok: true, id });
}
