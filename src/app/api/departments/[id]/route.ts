import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/state";
import { isHr } from "@/lib/roles";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || !isHr(user.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const body = await req.json() as { name?: string; branch_id?: string; branchId?: string };
  const current = await pool.query(`SELECT branch_id FROM departments WHERE id=$1`, [id]);
  if (!current.rows.length) return Response.json({ ok: false }, { status: 404 });
  const branchId = body.branchId ?? body.branch_id;
  if (user.role !== "super_admin" && (current.rows[0].branch_id !== user.branch_id || (branchId && branchId !== user.branch_id))) return Response.json({ ok: false, error: "Departemen berada di luar cabang Anda." }, { status: 403 });
  await pool.query(`UPDATE departments SET name=COALESCE($1,name), branch_id=COALESCE($2,branch_id) WHERE id=$3`, [body.name?.trim() || null, branchId || null, id]);
  const name = user.name;
  await writeAudit({ actorId: user.id, actorName: name, action: "Department updated", targetType: "department", targetId: id, detail: body.name ?? id, at: new Date().toISOString() });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || !isHr(user.role)) return Response.json({ ok: false }, { status: 403 });
  const { id } = await params;
  const current = await pool.query(`SELECT branch_id FROM departments WHERE id=$1`, [id]);
  if (!current.rows.length) return Response.json({ ok: false }, { status: 404 });
  if (user.role !== "super_admin" && current.rows[0].branch_id !== user.branch_id) return Response.json({ ok: false, error: "Departemen berada di luar cabang Anda." }, { status: 403 });
  try {
    await pool.query(`DELETE FROM departments WHERE id=$1`, [id]);
    const name = user.name;
    await writeAudit({ actorId: user.id, actorName: name, action: "Department deleted", targetType: "department", targetId: id, detail: id, at: new Date().toISOString() });
    return Response.json({ ok: true });
  } catch (error) {
    if ((error as { code?: string }).code === "23503") return Response.json({ ok: false, error: "Departemen masih dipakai data lain (karyawan/lowongan) dan tidak bisa dihapus." }, { status: 409 });
    return Response.json({ ok: false, error: "Gagal menghapus departemen." }, { status: 500 });
  }
}
