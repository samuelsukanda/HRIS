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

export function toastOk(msg: string) {
  void Swal.fire({ toast: true, position: "top-end", icon: "success", title: msg, showConfirmButton: false, timer: 2200, background: "#f6f5f0", color: "#1c1917" });
}

export function toastErr(msg: string) {
  void Swal.fire({ toast: true, position: "top-end", icon: "error", title: msg, showConfirmButton: false, timer: 2600, background: "#f6f5f0", color: "#1c1917" });
}

// Akun dinonaktifkan HR — dipakai saat percobaan login maupun saat sesi diakhiri paksa
export function alertAccountDisabled() {
  return Swal.fire({
    icon: "error",
    title: "Akun Dinonaktifkan",
    text: "Akun Anda telah dinonaktifkan oleh HR dan tidak dapat digunakan untuk masuk ke sistem. Hubungi HR untuk informasi lebih lanjut.",
    confirmButtonText: "Mengerti",
    confirmButtonColor: "#c03a2c",
    background: "#f6f5f0",
    color: "#1c1917",
    customClass: { popup: "rounded-md border border-rule" },
  });
}

// Ikon Phosphor (copy & check) inline — dialog Swal dirender di luar React
const COPY_ICON = `<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M192,72H56A16,16,0,0,0,40,88V200a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V88A16,16,0,0,0,192,72Zm0,128H56V88H192ZM96,40a8,8,0,0,1,8-8h96a16,16,0,0,1,16,16v96a8,8,0,0,1-16,0V48H104A8,8,0,0,1,96,40Z"/></svg>`;
const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,147.16,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/></svg>`;

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

// Dialog password sementara — hanya ditampilkan sekali setelah buat akun / reset password
export function showTempPassword(email: string, password: string) {
  return Swal.fire({
    icon: "success",
    title: "Password Sementara",
    html:
      `<p style="font-size:13px;margin-bottom:10px">Email login: <strong>${email.replace(/</g, "&lt;")}</strong></p>` +
      `<div style="display:flex;gap:8px;align-items:stretch">` +
      `<p id="swal-temp-password" style="flex:1;font-family:ui-monospace,monospace;font-size:18px;letter-spacing:1px;background:#fff;border:1px solid #d6d3cb;border-radius:4px;padding:10px;user-select:all">${password}</p>` +
      `<button id="swal-copy-btn" type="button" title="Salin password" style="display:inline-flex;align-items:center;gap:6px;border:1px solid #d6d3cb;background:#fff;border-radius:4px;padding:0 12px;font-size:13px;font-weight:600;color:#1c1917;cursor:pointer">${COPY_ICON}<span>Salin</span></button>` +
      `</div>` +
      `<p style="font-size:12px;color:#57534e;margin-top:10px"><strong>Password hanya ditampilkan sekali.</strong> Salin dan sampaikan kepada karyawan melalui saluran yang aman. Karyawan disarankan mengganti password setelah login pertama.</p>`,
    didOpen: () => {
      document.getElementById("swal-copy-btn")?.addEventListener("click", () => {
        const text = document.getElementById("swal-temp-password")?.textContent ?? "";
        void copyText(text).then(() => {
          const btn = document.getElementById("swal-copy-btn");
          if (btn) btn.innerHTML = `${CHECK_ICON}<span>Tersalin</span>`;
        });
      });
    },
    confirmButtonText: "Tutup",
    confirmButtonColor: "#2b4a6f",
    background: "#f6f5f0",
    color: "#1c1917",
    customClass: { popup: "rounded-md border border-rule" },
  });
}

// Form modal generik — returns values object or null if cancelled
// Field dengan `options` dirender sebagai <select> dropdown
export async function formModal<T extends Record<string, string>>(title: string, fields: { key: keyof T & string; label: string; value: string; type?: string; options?: { value: string; label: string }[] }[], focusKey?: string): Promise<T | null> {
  const html = fields
    .map((f) => {
      const control = f.options
        ? `<select id="swal-${f.key}" style="margin-top:4px;width:100%;border:1px solid #d6d3cb;background:#fff;padding:8px;font-size:14px;border-radius:4px">${f.options.map((o) => `<option value="${o.value.replace(/"/g, "&quot;")}"${o.value === f.value ? " selected" : ""}>${o.label.replace(/</g, "&lt;")}</option>`).join("")}</select>`
        : `<input id="swal-${f.key}" type="${f.type ?? "text"}" value="${String(f.value).replace(/"/g, "&quot;")}" style="margin-top:4px;width:100%;border:1px solid #d6d3cb;background:#fff;padding:8px;font-size:14px;border-radius:4px" />`;
      return `<label style="display:block;text-align:left;font-size:12px;margin-bottom:8px">${f.label}${control}</label>`;
    })
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
      if (el && typeof el.select === "function") el.select();
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
