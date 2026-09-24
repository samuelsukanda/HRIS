import { pool } from "@/db/client";
import { isHr } from "@/lib/roles";
import { writeAudit, writeNotification } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!isHr(user.role)) return Response.json({ ok: false, error: "Hanya HR yang dapat memproses reimbursement." }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { approve } = body as { level?: string; approve: boolean };
  if (typeof approve !== "boolean") return Response.json({ ok: false, error: "Keputusan wajib diisi." }, { status: 400 });

  const r = await pool.query(`SELECT * FROM reimbursements WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });
  const existing = r.rows[0];
  if (existing.status === "approved" || existing.status === "rejected") {
    return Response.json({ ok: false, error: "Reimbursement sudah diputuskan." }, { status: 409 });
  }

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  const actorName = empR.rows[0]?.name ?? user.employee_id;

  const approvals = (existing.approvals ?? []) as { level: string; byName: string; at: string; approved: boolean }[];
  const updatedApprovals = [...approvals, { level: "hr", byName: actorName, at: new Date().toISOString(), approved: approve }];
  const newStatus = approve ? "approved" : "rejected";

  await pool.query(`UPDATE reimbursements SET status=$1, approvals=$2 WHERE id=$3`, [newStatus, JSON.stringify(updatedApprovals), id]);

  await writeAudit({
    actorId: user.id, actorName,
    action: approve ? "Reimbursement approved" : "Reimbursement rejected",
    targetType: "reimbursement", targetId: id,
    detail: `${existing.category} Rp ${existing.amount.toLocaleString("id-ID")}`,
    after: newStatus, at: new Date().toISOString(),
  });

  // Notifikasi ke karyawan
  const userR = await pool.query(`SELECT id FROM users WHERE employee_id = $1`, [existing.employee_id]);
  if (userR.rows[0]) {
    await writeNotification({
      userId: userR.rows[0].id,
      title: approve ? "Reimbursement Disetujui" : "Reimbursement Ditolak",
      body: approve
        ? `Pengajuan reimbursement ${existing.category} Anda senilai Rp ${existing.amount.toLocaleString("id-ID")} telah disetujui oleh HR (${actorName}).`
        : `Pengajuan reimbursement ${existing.category} Anda senilai Rp ${existing.amount.toLocaleString("id-ID")} ditolak oleh HR (${actorName}).`,
      type: "info", link: "/app/reimbursements",
    });
  }

  return Response.json({ ok: true, status: newStatus });
}
