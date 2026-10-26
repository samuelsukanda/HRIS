import { readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { pool } from "@/db/client";
import { canManageEmployee } from "@/lib/server/access";
import { getSessionUser } from "@/lib/server/session";
import type { Role } from "@/lib/types";

const UPLOAD_DIR = join(process.cwd(), "var", "uploads");
const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { filename } = await params;
  const safeName = basename(filename);
  if (safeName !== filename || !/^[a-f0-9-]+\.(jpg|jpeg|png|webp|pdf)$/.test(safeName)) {
    return Response.json({ ok: false }, { status: 400 });
  }
  const record = await pool.query(`SELECT user_id FROM upload_records WHERE filename=$1`, [safeName]);
  const ownerId = record.rows[0]?.user_id as string | undefined;
  if (!ownerId) return Response.json({ ok: false }, { status: 404 });
  const url = `/api/uploads/${safeName}`;
  const references = await pool.query(
    `SELECT employee_id FROM leave_requests WHERE attachment_url=$1
     UNION SELECT employee_id FROM reimbursements WHERE attachment_url=$1
     UNION SELECT id AS employee_id FROM employees WHERE photo_url=$1`,
    [url],
  );
  const actor = { id: user.id, employeeId: user.employee_id, role: user.role as Role, branchId: user.branch_id };
  const targets = await pool.query(
    `SELECT id, branch_id, spv_id, manager_id FROM employees WHERE id = ANY($1::text[])`,
    [references.rows.map((row) => row.employee_id)],
  );
  const allowed = ownerId === user.id || targets.rows.some((target) => target.id !== user.employee_id && canManageEmployee(actor, {
    id: target.id,
    branchId: target.branch_id,
    spvId: target.spv_id,
    managerId: target.manager_id,
  }));
  if (!allowed) return Response.json({ ok: false }, { status: 403 });
  try {
    const bytes = await readFile(join(UPLOAD_DIR, safeName));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": CONTENT_TYPES[extname(safeName).toLowerCase()] ?? "application/octet-stream",
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ ok: false }, { status: 404 });
  }
}
