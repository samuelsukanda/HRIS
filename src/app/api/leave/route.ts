import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { nextId, writeAudit, writeNotification } from "@/lib/server/state";
import { toLocalISO, addDays } from "@/lib/format";

/** POST /api/leave — karyawan ajukan cuti */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const body = (await req.json()) as { typeId: string; startDate: string; endDate: string; reason: string };
  if (!body.typeId || !body.startDate || !body.endDate || !body.reason?.trim()) {
    return Response.json({ ok: false, error: "Lengkapi formulir." }, { status: 400 });
  }

  // hitung hari kalender inklusif
  let days = 1;
  for (let d = body.startDate; d < body.endDate; d = addDays(d, 1)) days++;

  const id = await nextId("leave_requests", "LRV");
  await pool.query(
    `INSERT INTO leave_requests (id,employee_id,type_id,start_date,end_date,days,reason,status,submitted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8)`,
    [id, user.employee_id, body.typeId, body.startDate, body.endDate, days, body.reason.trim(), new Date()],
  );

  const nameR = await pool.query(`SELECT name FROM employees WHERE id = $1`, [user.employee_id]);
  const empName = nameR.rows[0]?.name ?? "-";
  await writeAudit({
    actorId: user.id, actorName: empName,
    action: "Leave requested", targetType: "leave_request", targetId: id,
    detail: `${body.startDate} s.d. ${body.endDate} (${days} hari)`, at: new Date().toISOString(),
  });

  // Kirim notifikasi ke HR
  const hrs = await pool.query(`SELECT id FROM users WHERE role IN ('hr_manager', 'hr_admin', 'super_admin')`);
  for (const hr of hrs.rows) {
    await writeNotification({
      userId: hr.id,
      title: "Pengajuan Cuti Baru",
      body: `${empName} mengajukan cuti dari ${body.startDate} s.d. ${body.endDate} (${days} hari).`,
      type: "approval",
      link: "/admin/cuti",
    });
  }

  return Response.json({ ok: true, id });
}
