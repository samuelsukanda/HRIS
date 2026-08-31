import { pool } from "@/db/client";
import { writeAudit, writeNotification } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";

const HR_ROLES = ["hr_manager", "hr_admin", "super_admin"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!HR_ROLES.includes(user.role) && user.role !== "manager") return Response.json({ ok: false }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { level, approve } = body as { level: "manager" | "hr"; approve: boolean };

  if (!level) return Response.json({ ok: false, error: "Level wajib diisi." }, { status: 400 });

  const r = await pool.query(`SELECT * FROM reimbursements WHERE id=$1`, [id]);
  if (r.rows.length === 0) return Response.json({ ok: false }, { status: 404 });

  const existing = r.rows[0];
  if (existing.status === "approved" || existing.status === "rejected") {
    return Response.json({ ok: false, error: "Reimbursement sudah diputuskan." }, { status: 409 });
  }

  const approvals = (existing.approvals ?? []) as { level: string; byName: string; at: string; approved: boolean }[];

  // Guard: cek apakah level ini sudah approve sebelumnya
  const alreadyApproved = approvals.some((a) => a.level === level && a.approved);
  if (alreadyApproved) {
    return Response.json({ ok: false, error: `Level ${level} sudah approve sebelumnya.` }, { status: 409 });
  }

  // Guard: manager harus approve dulu sebelum HR
  if (level === "hr" && existing.status === "pending") {
    return Response.json({ ok: false, error: "Manager harus approve terlebih dahulu." }, { status: 409 });
  }

  const empR = await pool.query(`SELECT name FROM employees WHERE id=$1`, [user.employee_id]);
  const actorName = empR.rows[0]?.name ?? user.employee_id;

  const updatedApprovals = [...approvals, { level, byName: actorName, at: new Date().toISOString(), approved: approve }];

  let newStatus: string;
  if (!approve) {
    newStatus = "rejected";
  } else if (level === "manager") {
    newStatus = "manager_approved";
  } else {
    newStatus = "approved";
  }

  await pool.query(
    `UPDATE reimbursements SET status=$1, approvals=$2 WHERE id=$3`,
    [newStatus, JSON.stringify(updatedApprovals), id],
  );

  await writeAudit({
    actorId: user.id, actorName,
    action: approve ? `Reimbursement ${level} approved` : `Reimbursement ${level} rejected`,
    targetType: "reimbursement", targetId: id,
    detail: `${existing.category} Rp ${existing.amount.toLocaleString("id-ID")}`,
    after: newStatus, at: new Date().toISOString(),
  });

  // Kirim notifikasi ke karyawan
  const userR = await pool.query(`SELECT id FROM users WHERE employee_id = $1`, [existing.employee_id]);
  if (userR.rows[0]) {
    let titleStr = "";
    let bodyStr = "";
    if (newStatus === "rejected") {
      titleStr = "Reimbursement Ditolak";
      bodyStr = `Pengajuan reimbursement ${existing.category} Anda senilai Rp ${existing.amount.toLocaleString("id-ID")} ditolak oleh ${actorName}.`;
    } else if (newStatus === "manager_approved") {
      titleStr = "Reimbursement Disetujui Manager";
      bodyStr = `Pengajuan reimbursement ${existing.category} Anda senilai Rp ${existing.amount.toLocaleString("id-ID")} disetujui oleh Manager (${actorName}) dan menunggu approval HR.`;
    } else {
      titleStr = "Reimbursement Disetujui HR";
      bodyStr = `Pengajuan reimbursement ${existing.category} Anda senilai Rp ${existing.amount.toLocaleString("id-ID")} telah disetujui sepenuhnya.`;
    }

    await writeNotification({
      userId: userR.rows[0].id,
      title: titleStr,
      body: bodyStr,
      type: "info",
      link: "/app/reimbursements",
    });
  }

  // Jika disetujui Manager, kirim notifikasi ke HR untuk approval tahap 2
  if (newStatus === "manager_approved") {
    const hrs = await pool.query(`SELECT id FROM users WHERE role IN ('hr_manager', 'hr_admin', 'super_admin')`);
    for (const hr of hrs.rows) {
      await writeNotification({
        userId: hr.id,
        title: "Persetujuan Reimbursement Tahap 2",
        body: `Reimbursement ${existing.category} senilai Rp ${existing.amount.toLocaleString("id-ID")} telah disetujui Manager dan membutuhkan approval HR.`,
        type: "approval",
        link: "/admin/reimbursements",
      });
    }
  }

  return Response.json({ ok: true, status: newStatus });
}
