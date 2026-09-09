"use client";

import { useState } from "react";
import { Download, Table } from "@phosphor-icons/react";
import { Btn, EmptyState, PageHead, Select } from "@/components/ui";
import { downloadCsv } from "@/lib/format";
import { useHris } from "@/lib/store";

const BULAN_PENUH = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function lastMonths(n: number): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${BULAN_PENUH[d.getMonth()]} ${d.getFullYear()}`,
    };
  });
}

export default function AdminLaporanPage() {
  const { state } = useHris();
  const { data } = state;
  const [months] = useState(() => lastMonths(6));
  const [month, setMonth] = useState(() => months[0]?.value ?? "");

  const recs = data.attendance
    .filter((a) => a.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date) || a.employeeId.localeCompare(b.employeeId));

  const rows = data.employees.flatMap((e) => {
    const mine = recs.filter((a) => a.employeeId === e.id);
    if (mine.length === 0) return [];
    const hadir = mine.filter((a) => a.status === "present" || a.status === "wfh").length;
    const late = mine.filter((a) => a.status === "late").length;
    const nonHadir = mine.filter((a) => ["leave", "sick", "permission"].includes(a.status)).length;
    const absent = mine.filter((a) => a.status === "absent").length;
    const pct = Math.round(((hadir + late) / mine.length) * 100);
    return [{ emp: e, hadir, late, nonHadir, absent, pct }];
  });

  function exportCsv() {
    downloadCsv(
      `hris-absensi-${month}.csv`,
      ["EmployeeID", "Nama", "Tanggal", "Status", "CheckIn", "RiskScore"],
      recs.map((a) => {
        const emp = data.employees.find((e) => e.id === a.employeeId);
        return [a.employeeId, emp?.name ?? "", a.date, a.status, a.checkInAt ?? "", String(a.riskScore)];
      }),
    );
  }

  function exportCuti() {
    downloadCsv(
      `hris-cuti-${month}.csv`,
      ["EmployeeID", "Nama", "Jenis", "TanggalMulai", "TanggalAkhir", "Hari", "Alasan", "Status"],
      data.leaveRequests.filter((r) => r.startDate.startsWith(month)).map((r) => {
        const emp = data.employees.find((e) => e.id === r.employeeId);
        const type = data.leaveTypes.find((t) => t.id === r.typeId);
        return [r.employeeId, emp?.name ?? "", type?.name ?? r.typeId, r.startDate, r.endDate, String(r.days), r.reason, r.status];
      }),
    );
  }

  function exportLembur() {
    downloadCsv(
      `hris-lembur-${month}.csv`,
      ["EmployeeID", "Nama", "Tanggal", "JamMulai", "JamAkhir", "Durasi", "Alasan", "Status"],
      data.overtimeRequests.filter((r) => r.date.startsWith(month)).map((r) => {
        const emp = data.employees.find((e) => e.id === r.employeeId);
        return [r.employeeId, emp?.name ?? "", r.date, r.start, r.end, String(r.hours), r.reason, r.status];
      }),
    );
  }

  function exportReimbursement() {
    downloadCsv(
      `hris-reimbursement-${month}.csv`,
      ["EmployeeID", "Nama", "Kategori", "Jumlah", "Keterangan", "Status"],
      data.reimbursements.filter((r) => r.submittedAt?.startsWith(month)).map((r) => {
        const emp = data.employees.find((e) => e.id === r.employeeId);
        return [r.employeeId, emp?.name ?? "", r.category, String(r.amount), r.description, r.status];
      }),
    );
  }

  return (
    <>
      <PageHead
        title="Laporan"
        sub="Lihat dan kelola rekap kehadiran karyawan secara berkala."
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs whitespace-nowrap text-ink-faint">
          Periode
          <Select value={month} onChange={(ev) => setMonth(ev.target.value)} aria-label="Pilih periode bulan" className="w-48 px-2 py-1.5 text-xs">
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </label>
        <span className="mx-1 hidden h-5 w-px bg-rule sm:block" aria-hidden />
        <span className="text-xs font-semibold tracking-wide text-ink-faint uppercase">Export CSV:</span>
        <Btn variant="secondary" size="sm" icon={Download} onClick={exportCsv} disabled={recs.length === 0}>
          Absensi
        </Btn>
        <Btn variant="secondary" size="sm" icon={Download} onClick={exportCuti}>
          Cuti
        </Btn>
        <Btn variant="secondary" size="sm" icon={Download} onClick={exportLembur}>
          Lembur
        </Btn>
        <Btn variant="secondary" size="sm" icon={Download} onClick={exportReimbursement}>
          Reimburse
        </Btn>
      </div>

      <section className="border border-rule bg-card">
        <header className="flex items-baseline justify-between border-b border-rule px-5 py-3.5">
          <h2 className="font-semibold">
            Rekap Kehadiran —{" "}
            {months.find((m) => m.value === month)?.label ?? month}
          </h2>
          <span className="tnum text-xs text-ink-faint">{recs.length} rekaman</span>
        </header>
        {rows.length === 0 ? (
          <EmptyState
            icon={Table}
            title="Belum Ada Data"
            body="Tidak ada data absensi pada periode yang dipilih. Silakan pilih periode lain untuk melihat laporan."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-rule bg-paper text-left text-xs tracking-wide text-ink-faint uppercase">
                  <th className="px-5 py-2.5 font-semibold">Nama</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Hadir</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Late</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Non-Hadir</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Absent</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Kehadiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ledger/60">
                {rows.map((r) => (
                  <tr key={r.emp.id}>
                    <td className="px-5 py-3">
                      <p className="font-semibold">{r.emp.name}</p>
                      <p className="tnum text-xs text-ink-faint">{r.emp.id}</p>
                    </td>
                    <td className="tnum px-3 py-3 text-right">{r.hadir}</td>
                    <td className="tnum px-3 py-3 text-right">{r.late}</td>
                    <td className="tnum px-3 py-3 text-right">{r.nonHadir}</td>
                    <td className="tnum px-3 py-3 text-right">{r.absent}</td>
                    <td className="tnum px-5 py-3 text-right font-bold">{r.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="border-t border-rule bg-paper px-5 py-3 text-xs text-ink-faint">
          Ekspor CSV mencakup seluruh rekaman absensi periode terpilih. Ekspor Excel/PDF menyusul (Phase 3).
        </footer>
      </section>
    </>
  );
}
