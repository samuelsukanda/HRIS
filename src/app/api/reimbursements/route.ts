import { pool } from "@/db/client";
import { nextId, writeAudit, writeNotification } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

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

  const empR = await pool.query(`SELECT name, branch_id FROM employees WHERE id=$1`, [user.employee_id]);
  const empName = empR.rows[0]?.name ?? user.employee_id;
  const branchId = empR.rows[0]?.branch_id as string | null | undefined;
  await writeAudit({
    actorId: user.id, actorName: empName,
    action: "Reimbursement submitted", targetType: "reimbursement", targetId: id,
    detail: `${category} Rp ${amount.toLocaleString("id-ID")} — ${description}`, at: new Date().toISOString(),
  });

  // Notifikasi hanya ke HR aktif 1 cabang dengan pengaju
  if (branchId) {
    const hrR = await pool.query(
      `SELECT u.id FROM users u
       JOIN employees e ON e.id = u.employee_id
       WHERE u.role = 'hr' AND u.active = true AND e.branch_id = $1 AND u.id <> $2`,
      [branchId, user.id],
    );
    for (const row of hrR.rows) {
      await writeNotification({
        userId: row.id,
        title: "Reimbursement Baru",
        body: `${empName} mengajukan reimbursement ${category} Rp ${amount.toLocaleString("id-ID")}. Menunggu persetujuan Anda.`,
        type: "approval",
        link: "/admin/reimbursements",
      });
    }
  }

  return Response.json({ ok: true, id });
}
