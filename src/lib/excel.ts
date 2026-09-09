"use client";

// Ekspor .xlsx asli (SheetJS) — import dinamis agar tidak membebani bundle awal.
export async function exportExcel(filename: string, header: string[], rows: unknown[][]): Promise<void> {
  const XLSX = await import("xlsx");
  const name = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows.map((r) => r.map((v) => v ?? ""))]);
  ws["!cols"] = header.map((h, i) => ({
    wch: Math.max(h.length + 2, ...rows.slice(0, 200).map((r) => String(r[i] ?? "").length + 2)),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, name);
}
