import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { nextId, writeAudit, writeNotification } from "@/lib/server/state";
import { addDays, fmtDateLongID } from "@/lib/format";
import { isHr } from "@/lib/roles";

/** POST /api/leave — ajukan cuti (boleh untuk diri sendiri / admin untuk karyawan) */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const body = (await req.json()) as { typeId: string; startDate: string; endDate: string; reason: string; attachmentUrl?: string; employeeId?: string };
  if (!body.typeId || !body.startDate || !body.endDate || !body.reason?.trim()) {
    return Response.json({ ok: false, error: "Lengkapi formulir." }, { status: 400 });
  }
  if (body.endDate < body.startDate) {
    return Response.json({ ok: false, error: "Tanggal selesai sebelum tanggal mulai." }, { status: 400 });
  }

  const targetId = body.employeeId ?? user.employee_id;
  if (targetId !== user.employee_id) {
    if (!isHr(user.role)) {
      const emp = await pool.query(`SELECT spv_id, manager_id FROM employees WHERE id = $1`, [targetId]);
      const row = emp.rows[0];
      if (!row || (row.spv_id !== user.employee_id && row.manager_id !== user.employee_id)) {
        return Response.json({ ok: false, error: "Bukan karyawan bawahan Anda." }, { status: 403 });
      }
    }
  }

  // hitung hari kalender inklusif
  let days = 1;
  for (let d = body.startDate; d < body.endDate; d = addDays(d, 1)) days++;

  const id = await nextId("leave_requests", "LRV");
  await pool.query(
    `INSERT INTO leave_requests (id,employee_id,type_id,start_date,end_date,days,reason,status,submitted_at,attachment_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9)`,
    [id, targetId, body.typeId, body.startDate, body.endDate, days, body.reason.trim(), new Date(), body.attachmentUrl ?? null],
  );

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
