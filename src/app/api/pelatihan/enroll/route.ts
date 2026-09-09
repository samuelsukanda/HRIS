import { pool } from "@/db/client";
import { nextId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const body = await req.json();
  const { trainingId } = body as { trainingId: string };
  if (!trainingId) return Response.json({ ok: false, error: "Training ID wajib diisi." }, { status: 400 });

  const trainR = await pool.query(`SELECT * FROM trainings WHERE id=$1`, [trainingId]);
  if (trainR.rows.length === 0) return Response.json({ ok: false, error: "Pelatihan tidak ditemukan." }, { status: 404 });

  const existing = await pool.query(
    `SELECT id, status FROM training_enrollments WHERE training_id=$1 AND employee_id=$2`,
    [trainingId, user.employee_id],
  );
  if (existing.rows.some((r) => r.status !== "cancelled")) {
    return Response.json({ ok: false, error: "Sudah terdaftar." }, { status: 409 });
  }

  // UNIQUE (training_id, employee_id): baris cancelled tetap ada, jadi re-enroll = aktifkan ulang
  let id: string;
  const cancelled = existing.rows.find((r) => r.status === "cancelled");
  if (cancelled) {
    id = cancelled.id;
    await pool.query(`UPDATE training_enrollments SET status='enrolled', enrolled_at=NOW() WHERE id=$1`, [id]);
  } else {
    id = await nextId("training_enrollments", "TRE");
    await pool.query(
      `INSERT INTO training_enrollments (id,training_id,employee_id,status,enrolled_at)
       VALUES ($1,$2,$3,'enrolled',NOW())`,
      [id, trainingId, user.employee_id],
    );
  }

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({
    actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id,
    action: "Training enrollment", targetType: "training_enrollment", targetId: id,
    detail: `${empR.rows[0]?.name} → ${trainR.rows[0].title}`, at: new Date().toISOString(),
  });

  return Response.json({ ok: true, id });
}
