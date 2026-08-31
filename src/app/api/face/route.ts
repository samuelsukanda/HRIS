import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/state";
import { encryptDescriptor } from "@/lib/server/crypto";

/** PATCH /api/face — simpan/hapus descriptor wajah milik sendiri */
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { descriptor, remove } = (await req.json()) as { descriptor?: number[]; remove?: boolean };

  if (remove) {
    await pool.query(`UPDATE employees SET face_registered=false, face_descriptor=NULL WHERE id=$1`, [user.employee_id]);
    await writeAudit({
      actorId: user.id, actorName: user.name,
      action: "Face removed", targetType: "face_profile", targetId: user.employee_id,
      detail: "Template wajah dihapus oleh karyawan", at: new Date().toISOString(),
    });
    return Response.json({ ok: true });
  }

  if (!Array.isArray(descriptor) || descriptor.length !== 128 || descriptor.some((n) => typeof n !== "number")) {
    return Response.json({ ok: false, error: "Descriptor wajah tidak valid (128 dimensi)." }, { status: 400 });
  }
  const encrypted = encryptDescriptor(descriptor);
  await pool.query(`UPDATE employees SET face_registered=true, face_descriptor=$1 WHERE id=$2`, [
    encrypted, user.employee_id,
  ]);
  await writeAudit({
    actorId: user.id, actorName: user.name,
    action: "Face registered", targetType: "face_profile", targetId: user.employee_id,
    detail: "Template wajah terdaftar (descriptor 128-dim)", at: new Date().toISOString(),
  });
  return Response.json({ ok: true });
}
