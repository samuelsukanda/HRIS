import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { nextId, writeAudit, writeNotification } from "@/lib/server/state";
import { addDays, fmtDateLongID } from "@/lib/format";

/** POST /api/leave — karyawan ajukan cuti */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const body = (await req.json()) as { typeId: string; startDate: string; endDate: string; reason: string; attachmentUrl?: string };
  if (!body.typeId || !body.startDate || !body.endDate || !body.reason?.trim()) {
    return Response.json({ ok: false, error: "Lengkapi formulir." }, { status: 400 });
  }
  if (body.endDate < body.startDate) {
    return Response.json({ ok: false, error: "Tanggal selesai sebelum tanggal mulai." }, { status: 400 });
  }

  // hitung hari kalender inklusif
  let days = 1;
  for (let d = body.startDate; d < body.endDate; d = addDays(d, 1)) days++;

  const id = await nextId("leave_requests", "LRV");
  await pool.query(
    `INSERT INTO leave_requests (id,employee_id,type_id,start_date,end_date,days,reason,status,submitted_at,attachment_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9)`,
    [id, user.employee_id, body.typeId, body.startDate, body.endDate, days, body.reason.trim(), new Date(), body.attachmentUrl ?? null],
  );

  const empR = await pool.query(`SELECT name, spv_id, manager_id FROM employees WHERE id = $1`, [user.employee_id]);
  const empName = empR.rows[0]?.name ?? "-";
  const spvId: string | null = empR.rows[0]?.spv_id ?? null;
  const dateRange = `${fmtDateLongID(body.startDate)} s.d. ${fmtDateLongID(body.endDate)}`;
  await writeAudit({
    actorId: user.id, actorName: empName,
    action: "Leave requested", targetType: "leave_request", targetId: id,
    detail: `${body.startDate} s.d. ${body.endDate} (${days} hari)`, at: new Date().toISOString(),
  });

  // Notifikasi ke SPV
  if (spvId) {
    const spvUserR = await pool.query(`SELECT id FROM users WHERE employee_id = $1`, [spvId]);
    if (spvUserR.rows[0]) {
      await writeNotification({
        userId: spvUserR.rows[0].id,
        title: "Pengajuan Cuti Baru",
        body: `${empName} mengajukan cuti dari ${dateRange} (${days} hari). Menunggu persetujuan Anda.`,
        type: "approval",
        link: "/admin/cuti",
      });
    }
  }

  // Notifikasi ke HR
  const hrs = await pool.query(`SELECT id FROM users WHERE role IN ('hr', 'super_admin')`);
  for (const hr of hrs.rows) {
    await writeNotification({
      userId: hr.id,
      title: "Pengajuan Cuti Baru",
      body: `${empName} mengajukan cuti dari ${dateRange} (${days} hari).`,
      type: "approval",
      link: "/admin/cuti",
    });
  }

  return Response.json({ ok: true, id });
}
