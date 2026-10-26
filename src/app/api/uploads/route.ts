import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";

const MAX = 2 * 1024 * 1024;
const MAX_USER_BYTES = 20 * 1024 * 1024;
const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".pdf"]);
const IMAGE_ONLY = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const UPLOAD_DIR = join(process.cwd(), "var", "uploads");

function hasExpectedSignature(bytes: Buffer, ext: string): boolean {
  if (ext === ".pdf") return bytes.subarray(0, 5).toString() === "%PDF-";
  if (ext === ".jpg" || ext === ".jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (ext === ".png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (ext === ".webp") return bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  return false;
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const form = await req.formData();
  const kind = form.get("kind");
  const file = form.get("file") as File | null;
  if (!file) return Response.json({ ok: false, error: "File tidak ditemukan." }, { status: 400 });
  if (file.size > MAX) return Response.json({ ok: false, error: "File maksimal 2 MB." }, { status: 400 });
  const ext = extname(file.name).toLowerCase();
  const allowed = kind === "photo" ? IMAGE_ONLY : ALLOWED;
  if (!allowed.has(ext)) {
    const msg = kind === "photo" ? "Format foto harus jpg/png/webp." : "Format tidak didukung (jpg/png/pdf).";
    return Response.json({ ok: false, error: msg }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasExpectedSignature(bytes, ext)) {
    return Response.json({ ok: false, error: "Isi file tidak sesuai format." }, { status: 400 });
  }
  const used = await pool.query(`SELECT COALESCE(SUM(size_bytes),0)::int AS bytes FROM upload_records WHERE user_id=$1`, [user.id]);
  if (Number(used.rows[0]?.bytes ?? 0) + bytes.length > MAX_USER_BYTES) {
    return Response.json({ ok: false, error: "Kuota upload pengguna tercapai." }, { status: 413 });
  }
  const filename = `${randomUUID()}${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  const path = join(UPLOAD_DIR, filename);
  await writeFile(path, bytes);
  try {
    await pool.query(`INSERT INTO upload_records (filename,user_id,size_bytes) VALUES ($1,$2,$3)`, [filename, user.id, bytes.length]);
  } catch (error) {
    await unlink(path).catch(() => undefined);
    throw error;
  }
  return Response.json({ ok: true, url: `/api/uploads/${filename}` });
}
