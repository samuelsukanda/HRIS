// Formatter Indonesia untuk HRIS

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
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

export function fmtDateTimeID(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()} · ${fmtClock(d)}`;
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
