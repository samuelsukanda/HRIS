import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/state";

/** PATCH /api/profile-photo — karyawan memperbarui/menghapus foto profil milik sendiri */
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const body = (await req.json()) as { photoUrl?: string | null };
  const photoUrl = body.photoUrl ?? null;

  if (photoUrl !== null && !(photoUrl.startsWith("/api/uploads/") && photoUrl.length > "/api/uploads/".length)) {
    return Response.json({ ok: false, error: "URL foto tidak valid." }, { status: 400 });
  }
  if (photoUrl !== null) {
    const filename = photoUrl.slice("/api/uploads/".length);
    const upload = await pool.query(`SELECT user_id FROM upload_records WHERE filename=$1`, [filename]);
    if (!upload.rows.length || upload.rows[0].user_id !== user.id) {
      return Response.json({ ok: false, error: "Foto profil tidak valid." }, { status: 403 });
    }
  }

  await pool.query(`UPDATE employees SET photo_url=$1::text WHERE id=$2`, [photoUrl, user.employee_id]);
  await writeAudit({
    actorId: user.id, actorName: user.name,
    action: photoUrl ? "Photo updated" : "Photo removed", targetType: "employee", targetId: user.employee_id,
    detail: photoUrl ? "Foto profil diperbarui" : "Foto profil dihapus", at: new Date().toISOString(),
  });
  return Response.json({ ok: true });
}
