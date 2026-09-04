"use client";

import Swal from "sweetalert2";

// Buku Induk confirm dialog — paper bg, ink text, stamp-red confirm
export async function confirmDelete(label: string): Promise<boolean> {
  const r = await Swal.fire({
    title: `Hapus ${label}?`,
    text: "Data yang dihapus tidak bisa dikembalikan.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Ya, hapus",
    cancelButtonText: "Batal",
    confirmButtonColor: "#c03a2c",
    cancelButtonColor: "#6b7280",
    background: "#f6f5f0",
    color: "#1c1917",
    customClass: { popup: "rounded-md border border-rule", confirmButton: "rounded px-4 py-2 text-sm font-semibold", cancelButton: "rounded px-4 py-2 text-sm font-semibold" },
  });
  return r.isConfirmed;
}

export async function confirmAction(title: string, text?: string, confirmText = "Ya, lanjut"): Promise<boolean> {
  const r = await Swal.fire({
    title,
    text,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Batal",
    confirmButtonColor: "#2b4a6f",
    cancelButtonColor: "#6b7280",
    background: "#f6f5f0",
    color: "#1c1917",
    customClass: { popup: "rounded-md border border-rule", confirmButton: "rounded px-4 py-2 text-sm font-semibold", cancelButton: "rounded px-4 py-2 text-sm font-semibold" },
  });
  return r.isConfirmed;
}

export function toastOk(msg: string) {
  void Swal.fire({ toast: true, position: "top-end", icon: "success", title: msg, showConfirmButton: false, timer: 2200, background: "#f6f5f0", color: "#1c1917" });
}

export function toastErr(msg: string) {
  void Swal.fire({ toast: true, position: "top-end", icon: "error", title: msg, showConfirmButton: false, timer: 2600, background: "#f6f5f0", color: "#1c1917" });
}

// Form modal generik — returns values object or null if cancelled
export async function formModal<T extends Record<string, string>>(title: string, fields: { key: keyof T & string; label: string; value: string; type?: string }[], focusKey?: string): Promise<T | null> {
  const html = fields
    .map((f) => `<label style="display:block;text-align:left;font-size:12px;margin-bottom:8px">${f.label}<input id="swal-${f.key}" type="${f.type ?? "text"}" value="${String(f.value).replace(/"/g, "&quot;")}" style="margin-top:4px;width:100%;border:1px solid #d6d3cb;background:#fff;padding:8px;font-size:14px;border-radius:4px" /></label>`)
    .join("");
  const r = await Swal.fire({
    title,
    html,
    showCancelButton: true,
    confirmButtonText: "Simpan",
    cancelButtonText: "Batal",
    confirmButtonColor: "#2b4a6f",
    cancelButtonColor: "#6b7280",
    background: "#f6f5f0",
    color: "#1c1917",
    customClass: { popup: "rounded-md border border-rule" },
    didOpen: () => {
      const el = document.getElementById(`swal-${focusKey ?? fields[0].key}`) as HTMLInputElement | null;
      el?.focus();
      el?.select();
    },
    preConfirm: () => {
      const out: Record<string, string> = {};
      for (const f of fields) {
        const el = document.getElementById(`swal-${f.key}`) as HTMLInputElement | null;
        out[f.key] = el?.value ?? "";
      }
      return out;
    },
  });
  if (!r.isConfirmed || !r.value) return null;
  return r.value as T;
}
