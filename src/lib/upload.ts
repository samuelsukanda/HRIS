export async function uploadFile(file: File, kind?: string): Promise<string> {
  if (file.size > 2 * 1024 * 1024) throw new Error("File maksimal 2 MB.");
  const body = new FormData();
  body.append("file", file);
  if (kind) body.append("kind", kind);
  const response = await fetch("/api/uploads", { method: "POST", body });
  const result = await response.json().catch(() => ({})) as { ok?: boolean; url?: string; error?: string };
  if (!response.ok || !result.ok || !result.url) throw new Error(result.error ?? "Upload gagal.");
  return result.url;
}
