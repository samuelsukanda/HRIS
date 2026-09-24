import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { nextId, writeAudit, writeNotification } from "@/lib/server/state";
import { fmtDateLongID } from "@/lib/format";
import { isHr } from "@/lib/roles";

/** POST /api/overtime — ajukan lembur (boleh untuk diri sendiri / admin untuk karyawan) */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const b = (await req.json()) as { date: string; start: string; end: string; hours: number; reason: string; employeeId?: string };
  if (!b.date || !b.start || !b.end || !b.reason?.trim() || !b.hours) {
    return Response.json({ ok: false, error: "Lengkapi formulir." }, { status: 400 });
  }

  const targetId = b.employeeId ?? user.employee_id;
  if (targetId !== user.employee_id) {
    if (!isHr(user.role)) {
      const emp = await pool.query(`SELECT spv_id, manager_id FROM employees WHERE id = $1`, [targetId]);
      const row = emp.rows[0];
      if (!row || (row.spv_id !== user.employee_id && row.manager_id !== user.employee_id)) {
        return Response.json({ ok: false, error: "Bukan karyawan bawahan Anda." }, { status: 403 });
      }
    }
  }

  const id = await nextId("overtime_requests", "OTR");
  await pool.query(
    `INSERT INTO overtime_requests (id,employee_id,date,start_time,end_time,hours,reason,status,submitted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8)`,
    [id, targetId, b.date, b.start, b.end, b.hours, b.reason.trim(), new Date()],
  );
  const empR = await pool.query(`SELECT name, spv_id, manager_id FROM employees WHERE id = $1`, [targetId]);
  const empName = empR.rows[0]?.name ?? "-";
  const spvId: string | null = empR.rows[0]?.spv_id ?? null;
  const managerId: string | null = empR.rows[0]?.manager_id ?? null;
  await writeAudit({
    actorId: user.id, actorName: empName,
    action: "Overtime requested", targetType: "overtime_request", targetId: id,
    detail: `${b.date} ${b.start}–${b.end} (${b.hours} jam)`, at: new Date().toISOString(),
  });

  // Notifikasi approval: SPV jika ada, jika tidak langsung ke Manager
  const approverEmpId = spvId ?? managerId;
  if (approverEmpId) {
    const approverUserR = await pool.query(`SELECT id FROM users WHERE employee_id = $1`, [approverEmpId]);
    if (approverUserR.rows[0]) {
      await writeNotification({
        userId: approverUserR.rows[0].id,
        title: "Pengajuan Lembur Baru",
        body: `${empName} mengajukan lembur ${fmtDateLongID(b.date)} (${b.hours} jam). Menunggu persetujuan Anda.`,
        type: "approval",
        link: "/admin/lembur",
      });
    }
  }

  return Response.json({ ok: true, id });
}
