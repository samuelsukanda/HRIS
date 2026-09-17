import { pool } from "@/db/client";
import { writeAudit, writeNotification } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { level, approve } = body as { level: "spv" | "manager"; approve: boolean };

  if (!level) return Response.json({ ok: false, error: "Level wajib diisi." }, { status: 400 });

  const r = await pool.query(
    `SELECT rm.*, e.spv_id, e.manager_id FROM reimbursements rm
     JOIN employees e ON e.id = rm.employee_id WHERE rm.id=$1`,
    [id],
  );
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });

  const existing = r.rows[0];
  if (existing.status === "approved" || existing.status === "rejected") {
    return Response.json({ ok: false, error: "Reimbursement sudah diputuskan." }, { status: 409 });
  }

  // Validasi atasan
  if (level === "spv" && existing.spv_id !== user.employee_id) {
    return Response.json({ ok: false, error: "Anda bukan SPV pengajuan ini." }, { status: 403 });
  }
  if (level === "manager" && existing.manager_id !== user.employee_id) {
    return Response.json({ ok: false, error: "Anda bukan Manager pengajuan ini." }, { status: 403 });
  }
  if (level === "spv" && existing.status !== "pending") {
    return Response.json({ ok: false, error: "Sudah diproses." }, { status: 409 });
  }
  if (level === "manager" && existing.status !== "spv_approved" && existing.status !== "pending") {
    return Response.json({ ok: false, error: "Sudah diproses." }, { status: 409 });
  }

  const approvals = (existing.approvals ?? []) as { level: string; byName: string; at: string; approved: boolean }[];
  const alreadyApproved = approvals.some((a) => a.level === level && a.approved);
  if (alreadyApproved) return Response.json({ ok: false, error: `Level ${level} sudah approve sebelumnya.` }, { status: 409 });

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  const actorName = empR.rows[0]?.name ?? user.employee_id;

  const updatedApprovals = [...approvals, { level, byName: actorName, at: new Date().toISOString(), approved: approve }];
  let newStatus: string;
  if (!approve) {
    newStatus = "rejected";
  } else if (level === "spv") {
    newStatus = "spv_approved";
  } else {
    newStatus = "approved";
  }

  await pool.query(`UPDATE reimbursements SET status=$1, approvals=$2 WHERE id=$3`, [newStatus, JSON.stringify(updatedApprovals), id]);

  await writeAudit({
    actorId: user.id, actorName,
    action: approve ? `Reimbursement ${level} approved` : `Reimbursement ${level} rejected`,
    targetType: "reimbursement", targetId: id,
    detail: `${existing.category} Rp ${existing.amount.toLocaleString("id-ID")}`,
    after: newStatus, at: new Date().toISOString(),
  });

  // Notifikasi ke karyawan
  const userR = await pool.query(`SELECT id FROM users WHERE employee_id = $1`, [existing.employee_id]);
  if (userR.rows[0]) {
    let titleStr = "";
    let bodyStr = "";
    if (newStatus === "rejected") {
      titleStr = "Reimbursement Ditolak";
      bodyStr = `Pengajuan reimbursement ${existing.category} Anda senilai Rp ${existing.amount.toLocaleString("id-ID")} ditolak oleh ${actorName}.`;
    } else if (newStatus === "spv_approved") {
      titleStr = "Reimbursement Disetujui SPV";
      bodyStr = `Pengajuan reimbursement ${existing.category} Anda senilai Rp ${existing.amount.toLocaleString("id-ID")} disetujui SPV dan menunggu approval Manager.`;
    } else {
      titleStr = "Reimbursement Disetujui";
      bodyStr = `Pengajuan reimbursement ${existing.category} Anda senilai Rp ${existing.amount.toLocaleString("id-ID")} telah disetujui sepenuhnya.`;
    }
    await writeNotification({ userId: userR.rows[0].id, title: titleStr, body: bodyStr, type: "info", link: "/app/reimbursements" });
  }

  // Jika disetujui SPV, notifikasi ke Manager
  if (newStatus === "spv_approved" && existing.manager_id) {
    const mu = await pool.query(`SELECT id FROM users WHERE employee_id = $1`, [existing.manager_id]);
    if (mu.rows[0]) {
      await writeNotification({
        userId: mu.rows[0].id,
        title: "Reimbursement Perlu Persetujuan Manager",
        body: `Reimbursement ${existing.category} senilai Rp ${existing.amount.toLocaleString("id-ID")} telah disetujui SPV dan menunggu persetujuan Anda.`,
        type: "approval", link: "/admin/reimbursements",
      });
    }
  }

  return Response.json({ ok: true, status: newStatus });
}
