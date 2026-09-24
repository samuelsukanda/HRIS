import { pool } from "@/db/client";
import { nextId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

import { isHr } from "@/lib/roles";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false }, { status: 403 });

  const body = await req.json();
  const { employeeId, period, score, strengths, improvements, goals } = body as {
    employeeId: string; period: string; score: number; strengths: string; improvements: string; goals: string;
  };
  if (!employeeId || !period || !score || !strengths || !improvements || !goals) {
    return Response.json({ ok: false, error: "Field wajib kosong." }, { status: 400 });
  }
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return Response.json({ ok: false, error: "Skor harus 1–5." }, { status: 400 });
  }

  const id = await nextId("performance_reviews", "PRF");
  await pool.query(
    `INSERT INTO performance_reviews (id,employee_id,reviewer_id,period,score,strengths,improvements,goals,status,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',NOW())`,
    [id, employeeId, user.employee_id, period, score, strengths, improvements, goals],
  );

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  const targetR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [employeeId]);
  await writeAudit({
    actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id,
    action: "Performance review submitted", targetType: "performance_review", targetId: id,
    detail: `${empR.rows[0]?.name} → ${targetR.rows[0]?.name ?? employeeId} (${period}, score: ${score})`,
    at: new Date().toISOString(),
  });

  return Response.json({ ok: true, id });
}
