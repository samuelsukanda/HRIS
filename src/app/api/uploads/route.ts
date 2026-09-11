import { writeFile, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/server/session";

const MAX = 2 * 1024 * 1024; // 2 MB
const ALLOWED = new Set([".jpg",".jpeg",".png",".pdf"]);
const IMAGE_ONLY = new Set([".jpg",".jpeg",".png",".webp"]);

export async function POST(req: Request) {
  const u = await getSessionUser(); if (!u) return Response.json({ ok: false }, { status: 401 });
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
  const filename = `${randomUUID()}${ext}`;
  const dir = join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const bytes = await file.arrayBuffer();
  await writeFile(join(dir, filename), Buffer.from(bytes));
  return Response.json({ ok: true, url: `/uploads/${filename}` });
}
