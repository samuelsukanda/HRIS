import { pool } from "@/db/client";
import { nextId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const body = await req.json() as { trainingId?: unknown } | null;
  const trainingId = typeof body?.trainingId === "string" ? body.trainingId : "";
  if (!trainingId) return Response.json({ ok: false, error: "Training ID wajib diisi." }, { status: 400 });

  const client = await pool.connect();
  let id = "";
  let trainingTitle = "";
  try {
    await client.query("BEGIN");
    const trainR = await client.query(`SELECT * FROM trainings WHERE id=$1 FOR UPDATE`, [trainingId]);
    if (trainR.rows.length === 0) {
      await client.query("ROLLBACK");
      return Response.json({ ok: false, error: "Pelatihan tidak ditemukan." }, { status: 404 });
    }
    const training = trainR.rows[0];
    const employeeR = await client.query(`SELECT branch_id FROM employees WHERE id=$1`, [user.employee_id]);
    if (training.branch_id && training.branch_id !== employeeR.rows[0]?.branch_id) {
      await client.query("ROLLBACK");
      return Response.json({ ok: false, error: "Pelatihan tidak tersedia untuk cabang Anda." }, { status: 403 });
    }

    const existing = await client.query(
      `SELECT id, status FROM training_enrollments WHERE training_id=$1 AND employee_id=$2`,
      [trainingId, user.employee_id],
    );
    if (existing.rows.some((row) => row.status !== "cancelled")) {
      await client.query("ROLLBACK");
      return Response.json({ ok: false, error: "Sudah terdaftar." }, { status: 409 });
    }

    const countR = await client.query(
      `SELECT COUNT(*)::int AS count FROM training_enrollments WHERE training_id=$1 AND status <> 'cancelled'`,
      [trainingId],
    );
    if (Number(countR.rows[0]?.count ?? 0) >= Number(training.max_participants)) {
      await client.query("ROLLBACK");
      return Response.json({ ok: false, error: "Kapasitas pelatihan penuh." }, { status: 409 });
    }

    const cancelled = existing.rows.find((row) => row.status === "cancelled");
    if (cancelled) {
      id = cancelled.id;
      await client.query(`UPDATE training_enrollments SET status='enrolled', enrolled_at=NOW() WHERE id=$1`, [id]);
    } else {
      id = await nextId("training_enrollments", "TRE");
      await client.query(
        `INSERT INTO training_enrollments (id,training_id,employee_id,status,enrolled_at)
         VALUES ($1,$2,$3,'enrolled',NOW())`,
        [id, trainingId, user.employee_id],
      );
    }
    trainingTitle = training.title;
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await writeAudit({
    actorId: user.id, actorName: user.name,
    action: "Training enrollment", targetType: "training_enrollment", targetId: id,
    detail: `${user.name} → ${trainingTitle}`, at: new Date().toISOString(),
  });

  return Response.json({ ok: true, id });
}
