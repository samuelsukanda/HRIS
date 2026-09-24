import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { nextId, writeAudit, writeNotification } from "@/lib/server/state";
import { fmtDateLongID } from "@/lib/format";

export async function GET(req: Request) {
  const u = await getSessionUser();
  if (!u) return Response.json({ ok: false }, { status: 401 });
  const mine = u.role === "employee";
  const r = mine
    ? await pool.query(`SELECT s.*, e.name emp_name FROM shift_swaps s JOIN employees e ON e.id=s.employee_id WHERE s.employee_id=$1 ORDER BY s.created_at DESC`, [u.employee_id])
    : await pool.query(`SELECT s.*, e.name emp_name FROM shift_swaps s JOIN employees e ON e.id=s.employee_id ORDER BY s.created_at DESC`);
  return Response.json({ swaps: r.rows });
}

export async function POST(req: Request) {
  const u = await getSessionUser();
  if (!u) return Response.json({ ok: false }, { status: 401 });
  const body = await req.json() as Record<string, unknown>;
  const date = typeof body.date === "string" ? body.date : "";
  if (!date) return Response.json({ ok: false, error: "Tanggal wajib." }, { status: 400 });
  const existing = await pool.query(`SELECT shift_id FROM roster WHERE employee_id=$1 AND date=$2`, [u.employee_id, date]);
  const fromShiftId = existing.rows[0]?.shift_id ?? null;
  const targetShiftId = typeof body.targetShiftId === "string" ? body.targetShiftId || null : null;
  const reason = typeof body.reason === "string" ? body.reason : "";
  const id = await nextId("shift_swaps", "SWP");
  await pool.query(
    `INSERT INTO shift_swaps (id,employee_id,date,from_shift_id,target_shift_id,reason,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,'pending',NOW())`,
    [id, u.employee_id, date, fromShiftId, targetShiftId, reason],
  );
  const emp = (await pool.query(`SELECT name FROM employees WHERE id=$1`, [u.employee_id])).rows[0]?.name ?? u.employee_id;
  await writeAudit({ actorId: u.id, actorName: emp, action: "Shift swap requested", targetType: "shift_swap", targetId: id, detail: `${date} → ${targetShiftId ?? "Off"}`, at: new Date().toISOString() });

  // Notifikasi ke SPV saja
  const empR = await pool.query(`SELECT spv_id FROM employees WHERE id=$1`, [u.employee_id]);
  const spvId = empR.rows[0]?.spv_id;
  if (spvId) {
    const spvUser = await pool.query(`SELECT id FROM users WHERE employee_id=$1 AND active=true`, [spvId]);
    if (spvUser.rows[0]) {
      await writeNotification({ userId: spvUser.rows[0].id, title: "Permintaan Tukar Shift", body: `${emp} ajukan tukar shift ${fmtDateLongID(date)} → ${targetShiftId ?? "Off"}`, type: "approval", link: "/admin/jadwal" });
    }
  }

  return Response.json({ ok: true, id });
}
