import { pool } from "@/db/client";
import { nextId, writeAudit } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const body = await req.json();
  const { category, amount, description, attachmentUrl } = body as { category: string; amount: number; description: string; attachmentUrl?: string };
  if (!category || !amount || !description) return Response.json({ ok: false, error: "Field wajib kosong." }, { status: 400 });

  const id = await nextId("reimbursements", "RBM");
  await pool.query(
    `INSERT INTO reimbursements (id,employee_id,category,amount,description,status,submitted_at,approvals,attachment_url)
     VALUES ($1,$2,$3,$4,$5,'pending',NOW(),'[]',$6)`,
    [id, user.employee_id, category, amount, description, attachmentUrl ?? null],
  );

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  await writeAudit({
    actorId: user.id, actorName: empR.rows[0]?.name ?? user.employee_id,
    action: "Reimbursement submitted", targetType: "reimbursement", targetId: id,
    detail: `${category} Rp ${amount.toLocaleString("id-ID")} — ${description}`, at: new Date().toISOString(),
  });

  return Response.json({ ok: true, id });
}
