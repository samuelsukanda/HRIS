// Formatter Indonesia untuk HRIS

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
export const BULAN = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];
export const BULAN_LONG = [
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

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function inclusiveDays(start: string, end: string): number {
  if (!isCalendarDate(start) || !isCalendarDate(end) || end < start) return 0;
  return Math.floor((Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86_400_000) + 1;
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
