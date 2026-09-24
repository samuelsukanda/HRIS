import { pool } from "@/db/client";
import { nextId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const body = await req.json();
  const { jobPostingId, name, email, phone } = body as { jobPostingId: string; name: string; email: string; phone: string };
  if (!jobPostingId || !name || !email || !phone) return Response.json({ ok: false, error: "Field wajib kosong." }, { status: 400 });
  if (!["hr", "super_admin"].includes(user.role)) {
    return Response.json({ ok: false, error: "Hanya HR." }, { status: 403 });
  }
  const jobR = await pool.query(`SELECT id FROM job_postings WHERE id=$1`, [jobPostingId]);
  if (jobR.rows.length === 0) return Response.json({ ok: false, error: "Lowongan tidak ditemukan." }, { status: 404 });

  const id = await nextId("candidates", "CND");
  await pool.query(
    `INSERT INTO candidates (id,job_posting_id,name,email,phone,status,applied_at,notes)
     VALUES ($1,$2,$3,$4,$5,'applied',NOW(),NULL)`,
    [id, jobPostingId, name, email, phone],
  );

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({
    actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id,
    action: "Candidate applied", targetType: "candidate", targetId: id,
    detail: `${name} → ${jobPostingId}`, at: new Date().toISOString(),
  });

  return Response.json({ ok: true, id });
}
