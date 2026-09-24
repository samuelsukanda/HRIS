// Formatter Indonesia untuk HRIS

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];
const BULAN_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function parseLocalISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Unduh string CSV (dengan BOM agar Excel baca UTF-8) sebagai file. */
export function downloadCsv(filename: string, header: string[], rows: unknown[][]): void {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "﻿" + [header.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function addDays(iso: string, n: number): string {
  const d = parseLocalISO(iso);
  d.setDate(d.getDate() + n);
  return toLocalISO(d);
}

export function fmtDateID(iso: string): string {
  const d = parseLocalISO(iso);
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtDateShortID(iso: string): string {
  const d = parseLocalISO(iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]}`;
}

/** "Rab, 25 Sep - 30 Sep 2026" — rentang; hari yang sama → fmtDateID. */
export function fmtDateRangeID(start: string, end: string): string {
  if (start === end) return fmtDateID(start);
  const s = parseLocalISO(start);
  const e = parseLocalISO(end);
  return `${HARI[s.getDay()]}, ${s.getDate()} ${BULAN[s.getMonth()]} - ${e.getDate()} ${BULAN[e.getMonth()]} ${e.getFullYear()}`;
}

export function fmtDateTimeID(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()} · ${fmtClock(d)}`;
}

function toDateLong(v: string | Date): Date {
  if (v instanceof Date) return v;
  return v.length === 10 ? parseLocalISO(v) : new Date(v);
}

/** "25 September 2026" — terima ISO date string atau Date (hasil query PG). */
export function fmtDateLongID(v: string | Date): string {
  const d = toDateLong(v);
  return `${d.getDate()} ${BULAN_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** "25 September 2026 18:00" — untuk timestamp keputusan dsb. */
export function fmtDateTimeLongID(v: string | Date): string {
  const d = toDateLong(v);
  return `${fmtDateLongID(d)} ${fmtClock(d)}`;
}

function fmtClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function fmtClockFromDate(d: Date): string {
  return fmtClock(d);
}

export function fmtRupiah(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
