import { pool } from "@/db/client";
import { canManageEmployee } from "@/lib/server/access";
import { getSessionUser } from "@/lib/server/session";
import { nextId, writeAudit, writeNotification } from "@/lib/server/state";
import { fmtDateLongID, inclusiveDays, isCalendarDate } from "@/lib/format";
import { isHr } from "@/lib/roles";

/** POST /api/leave — ajukan cuti (boleh untuk diri sendiri / admin untuk karyawan) */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const body = (await req.json()) as { typeId: string; startDate: string; endDate: string; reason: string; attachmentUrl?: string; employeeId?: string };
  if (!body.typeId || !body.startDate || !body.endDate || !body.reason?.trim()) {
    return Response.json({ ok: false, error: "Lengkapi formulir." }, { status: 400 });
  }
  if (!isCalendarDate(body.startDate) || !isCalendarDate(body.endDate) || body.endDate < body.startDate) {
    return Response.json({ ok: false, error: "Tanggal tidak valid." }, { status: 400 });
  }
  const days = inclusiveDays(body.startDate, body.endDate);
  if (days < 1) return Response.json({ ok: false, error: "Tanggal selesai sebelum tanggal mulai." }, { status: 400 });

  const targetId = body.employeeId ?? user.employee_id;
  const targetResult = await pool.query(
    `SELECT id, branch_id, spv_id, manager_id FROM employees WHERE id = $1`,
    [targetId],
  );
  const targetEmployee = targetResult.rows[0];
  if (!targetEmployee) return Response.json({ ok: false, error: "Karyawan tidak ditemukan." }, { status: 404 });
  if (targetId !== user.employee_id && !canManageEmployee({ id: user.id, employeeId: user.employee_id, role: user.role, branchId: user.branch_id }, targetEmployee) && isHr(user.role)) {
    return Response.json({ ok: false, error: "Karyawan berada di luar cabang Anda." }, { status: 403 });
  }
  if (targetId !== user.employee_id && !isHr(user.role) && !canManageEmployee({ id: user.id, employeeId: user.employee_id, role: user.role, branchId: user.branch_id }, targetEmployee)) {
    return Response.json({ ok: false, error: "Bukan karyawan bawahan Anda." }, { status: 403 });
  }

  const typeResult = await pool.query(`SELECT id, allocation_days, requires_attachment FROM leave_types WHERE id = $1`, [body.typeId]);
  const leaveType = typeResult.rows[0];
  if (!leaveType) return Response.json({ ok: false, error: "Jenis cuti tidak valid." }, { status: 400 });
  if (leaveType.requires_attachment && !body.attachmentUrl) {
    return Response.json({ ok: false, error: "Lampiran wajib untuk jenis cuti ini." }, { status: 400 });
  }
  if (body.attachmentUrl) {
    const filename = body.attachmentUrl.split("/").pop() ?? "";
    const upload = await pool.query(`SELECT user_id FROM upload_records WHERE filename=$1`, [filename]);
    const canManageTarget = targetId !== user.employee_id && user.role !== "employee" && canManageEmployee({ id: user.id, employeeId: user.employee_id, role: user.role, branchId: user.branch_id }, targetEmployee);
    if (!upload.rows.length || (upload.rows[0].user_id !== user.id && !canManageTarget)) {
      return Response.json({ ok: false, error: "Lampiran tidak valid." }, { status: 400 });
    }
  }

  const id = await nextId("leave_requests", "LRV");
  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const nextYearStart = `${currentYear + 1}-01-01`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const reserved = await client.query(
      `SELECT COALESCE(SUM(days),0)::int AS days FROM leave_requests
       WHERE employee_id=$1 AND type_id=$2 AND status IN ('pending','spv_approved','approved')
         AND start_date >= $3 AND start_date < $4`,
      [targetId, body.typeId, yearStart, nextYearStart],
    );
    if (Number(reserved.rows[0]?.days ?? 0) + days > leaveType.allocation_days) {
      await client.query("ROLLBACK");
      return Response.json({ ok: false, error: "Saldo cuti tidak mencukupi." }, { status: 409 });
    }
    const overlap = await client.query(
      `SELECT 1 FROM leave_requests
       WHERE employee_id=$1 AND status IN ('pending','spv_approved','approved')
       AND start_date <= $3 AND end_date >= $2 LIMIT 1`,
      [targetId, body.startDate, body.endDate],
    );
    if (overlap.rows.length) {
      await client.query("ROLLBACK");
      return Response.json({ ok: false, error: "Tanggal sudah memiliki pengajuan cuti." }, { status: 409 });
    }
    await client.query(
      `INSERT INTO leave_requests (id,employee_id,type_id,start_date,end_date,days,reason,status,submitted_at,attachment_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9)`,
      [id, targetId, body.typeId, body.startDate, body.endDate, days, body.reason.trim(), new Date(), body.attachmentUrl ?? null],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const empR = await pool.query(`SELECT name, spv_id, manager_id FROM employees WHERE id = $1`, [targetId]);
  const empName = empR.rows[0]?.name ?? "-";
  const spvId: string | null = empR.rows[0]?.spv_id ?? null;
  const managerId: string | null = empR.rows[0]?.manager_id ?? null;
  const dateRange = `${fmtDateLongID(body.startDate)} s.d. ${fmtDateLongID(body.endDate)}`;
  await writeAudit({
    actorId: user.id, actorName: empName,
    action: "Leave requested", targetType: "leave_request", targetId: id,
    detail: `${body.startDate} s.d. ${body.endDate} (${days} hari)`, at: new Date().toISOString(),
  });

  // Notifikasi approval: SPV jika ada, jika tidak langsung ke Manager
  const approverEmpId = spvId ?? managerId;
  if (approverEmpId) {
    const approverUserR = await pool.query(`SELECT id FROM users WHERE employee_id = $1`, [approverEmpId]);
    if (approverUserR.rows[0]) {
      await writeNotification({
        userId: approverUserR.rows[0].id,
        title: "Pengajuan Cuti Baru",
        body: `${empName} mengajukan cuti dari ${dateRange} (${days} hari). Menunggu persetujuan Anda.`,
        type: "approval",
        link: "/admin/cuti",
      });
    }
  }

  return Response.json({ ok: true, id });
}
