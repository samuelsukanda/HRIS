"use client";

import { useEffect, useState } from "react";
import { CaretDown, Printer, Wallet } from "@phosphor-icons/react";
import { Btn, EmptyState, PageHead, Select, Stamp } from "@/components/ui";
import { fmtDateID, fmtDateTimeID, fmtRupiah } from "@/lib/format";
import type { PayrollBreakdown } from "@/lib/payroll";

interface Slip {
  period: string;
  approvedAt: string | null;
  breakdown: PayrollBreakdown;
}

interface EmployeeInfo {
  nik: string;
  name: string;
  joinDate: string;
  employmentType: string;
  bankName: string;
  bankAccount: string;
  baseSalary: number;
  allowance: number;
  position: string;
  department: string;
}

const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function formatPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${NAMA_BULAN[(m ?? 1) - 1]} ${y}`;
}

const STATUS_KERJA: Record<string, string> = {
  permanent: "Karyawan Tetap",
  contract: "Kontrak",
  probation: "Masa Percobaan",
};

export default function MyPayslips() {
  const [slips, setSlips] = useState<Slip[] | null>(null);
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [printPeriod, setPrintPeriod] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/payroll/mine")
      .then((r) => r.json())
      .then((j) => {
        setSlips(j.slips ?? []);
        setEmployee(j.employee ?? null);
        setPrintPeriod(j.slips?.[0]?.period ?? null);
      })
      .catch(() => setSlips([]));
  }, []);

  const selected = slips?.find((s) => s.period === printPeriod) ?? null;

  return (
    <>
      <div className="print:hidden">
        <PageHead title="Slip Gaji" sub="Akses riwayat slip gaji bulanan yang telah diproses." />

        {slips !== null && slips.length > 0 && (
          <div className="mb-5 border border-rule bg-card p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Cetak slip gaji</p>
            <div className="flex gap-2">
              <Select
                aria-label="Pilih bulan slip yang akan dicetak"
                value={printPeriod ?? ""}
                onChange={(e) => setPrintPeriod(e.target.value)}
                className="min-w-0 flex-1"
              >
                {slips.map((s) => (
                  <option key={s.period} value={s.period}>
                    {formatPeriod(s.period)}
                  </option>
                ))}
              </Select>
              <Btn icon={Printer} onClick={() => window.print()} disabled={!selected} className="whitespace-nowrap">
                Cetak / Simpan PDF
              </Btn>
            </div>
            {selected && (
              <p className="tnum mt-2 font-mono text-xs text-ink-faint">
                Take-home {formatPeriod(selected.period)}: {fmtRupiah(selected.breakdown.net)}
              </p>
            )}
          </div>
        )}

        {slips === null ? (
          <p className="tnum animate-pulse font-mono text-sm text-ink-faint">Memuat…</p>
        ) : slips.length === 0 ? (
          <EmptyState icon={Wallet} title="Belum ada slip" body="Slip muncul setelah HR menjalankan dan menyetujui payroll periode berjalan." />
        ) : (
          <ul className="space-y-3">
            {slips.map((s) => {
              const isOpen = open === s.period;
              return (
                <li key={s.period} className="border border-rule bg-card">
                  <button
                    onClick={() => setOpen(isOpen ? null : s.period)}
                    aria-expanded={isOpen}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-black/[0.02]"
                  >
                    <div>
                      <p className="text-sm font-bold">{formatPeriod(s.period)}</p>
                      <p className="tnum mt-0.5 font-mono text-xs text-ink-soft">
                        Take-home {fmtRupiah(s.breakdown.net)}
                      </p>
                    </div>
                    <span className="flex items-center gap-2">
                      <Stamp kind="approved">Paid</Stamp>
                      <CaretDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </span>
                  </button>
                  <div className={isOpen ? "" : "hidden"}>
                    <dl className="divide-y divide-ledger/60 border-t border-rule px-4 text-sm">
                      <Row k="Gaji pokok" v={fmtRupiah(s.breakdown.basePaid)} />
                      <Row k="Tunjangan tetap" v={fmtRupiah(s.breakdown.allowancePaid)} />
                      {s.breakdown.overtimePay > 0 && (
                        <Row
                          k={`Lembur ${s.breakdown.overtimeHours} jam`}
                          v={`+${fmtRupiah(s.breakdown.overtimePay)}`}
                        />
                      )}
                      {s.breakdown.alphaDeduction > 0 && (
                        <Row
                          k={`Potongan alpha ${s.breakdown.alphaDays} hari`}
                          v={`−${fmtRupiah(s.breakdown.alphaDeduction)}`}
                          neg
                        />
                      )}
                      <Row k="Bruto" v={fmtRupiah(s.breakdown.gross)} bold />
                      <Row k="BPJS Kesehatan (1%)" v={`−${fmtRupiah(s.breakdown.bpjsHealth)}`} neg />
                      <Row k="BPJS JHT (2%)" v={`−${fmtRupiah(s.breakdown.bpjsJht)}`} neg />
                      <Row k="PPH21" v={`−${fmtRupiah(s.breakdown.tax)}`} neg />
                      <div className="flex justify-between py-2.5">
                        <dt className="font-bold">Take-home pay</dt>
                        <dd className="tnum font-mono font-bold text-official">{fmtRupiah(s.breakdown.net)}</dd>
                      </div>
                    </dl>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Dokumen cetak — hanya periode terpilih */}
      {selected && (
        <div className="hidden print:block">
          <SlipDocument slip={selected} employee={employee} />
        </div>
      )}
    </>
  );
}

function SlipDocument({ slip, employee }: { slip: Slip; employee: EmployeeInfo | null }) {
  const b = slip.breakdown;
  // Konvensi slip Indonesia: gaji & tunjangan nominal, potongan alpha sebagai
  // baris negatif — kolom pendapatan menutup persis ke Bruto (gross engine):
  // baseSalary + allowance + lembur − alphaDeduction = gross.
  const baseNominal = employee ? employee.baseSalary : b.basePaid;
  const allowNominal = employee ? employee.allowance : b.allowancePaid;
  const earnings: { k: string; v: number; neg?: boolean }[] = [
    { k: "Gaji pokok", v: baseNominal },
    { k: "Tunjangan tetap", v: allowNominal },
    ...(b.overtimePay > 0 ? [{ k: `Lembur ${b.overtimeHours} jam (×${fmtNum(b.overtimeRate)}/jam)`, v: b.overtimePay }] : []),
    ...(b.alphaDeduction > 0 ? [{ k: `Potongan alpha ${b.alphaDays} hari`, v: b.alphaDeduction, neg: true }] : []),
  ];
  const deductions = [
    { k: "BPJS Kesehatan (1%)", v: b.bpjsHealth },
    { k: "BPJS JHT (2%)", v: b.bpjsJht },
    { k: "PPH21", v: b.tax },
  ];
  const totalPotongan = deductions.reduce((a, d) => a + d.v, 0);
  const acc = employee?.bankAccount ?? "";
  const accMasked = acc.length > 4 ? `••••${acc.slice(-4)}` : acc;

  return (
    <article aria-label={`Slip gaji ${formatPeriod(slip.period)}`} className="slip-doc mx-auto w-full max-w-[210mm] border-2 border-ink bg-white p-6 text-ink print:break-inside-avoid print:border-0 print:p-0">
      {/* Kepala dokumen */}
      <div className="flex items-start justify-between border-b-2 border-ink pb-3">
        <div>
          <p className="font-mono text-sm font-bold tracking-[0.3em]">HRIS</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-ink-soft">Sistem Informasi Sumber Daya Manusia</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs font-bold tracking-[0.2em] text-stamp-deep">SLIP GAJI</p>
          <p className="tnum mt-0.5 font-mono text-[10px] text-ink-soft">
            No. Ref: PS/{slip.period}/{employee?.nik ?? "—"}
          </p>
        </div>
      </div>

      {/* Judul */}
      <div className="py-4 text-center">
        <h2 className="text-base font-bold tracking-[0.35em]">SLIP GAJI KARYAWAN</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Periode: <span className="font-semibold text-ink">{formatPeriod(slip.period)}</span>
        </p>
      </div>

      {/* A. Informasi karyawan */}
      <SectionTitle no="A" title="Informasi Karyawan" />
      <dl className="mt-2 grid grid-cols-[auto_1fr_auto_1fr] gap-x-5 gap-y-1.5 pb-4">
        <Info k="Nama" v={employee?.name ?? "—"} />
        <Info k="NIK" v={employee?.nik ?? "—"} mono />
        <Info k="Jabatan" v={employee?.position ?? "—"} />
        <Info k="Departemen" v={employee?.department ?? "—"} />
        <Info k="Status" v={STATUS_KERJA[employee?.employmentType ?? ""] ?? employee?.employmentType ?? "—"} />
        <Info k="Bergabung" v={employee?.joinDate ? fmtDateID(employee.joinDate) : "—"} mono />
        <Info k="Rekening" v={`${employee?.bankName ?? "—"} ${accMasked}`} mono />
      </dl>

      {/* B. Rincian komputasi */}
      <SectionTitle no="B" title="Rincian Pendapatan & Potongan" />
      <div className="mt-2 grid grid-cols-2 gap-x-8 pb-4">
        <div>
          <p className="border-b border-ink pb-1 text-xs font-bold uppercase tracking-widest">Pendapatan</p>
          {earnings.map((e) => (
            <MoneyRow key={e.k} k={e.k} v={e.neg ? `−${fmtRupiah(e.v)}` : fmtRupiah(e.v)} neg={e.neg} />
          ))}
        </div>
        <div>
          <p className="border-b border-ink pb-1 text-xs font-bold uppercase tracking-widest">Potongan</p>
          {deductions.map((d) => (
            <MoneyRow key={d.k} k={d.k} v={`−${fmtRupiah(d.v)}`} neg />
          ))}
        </div>
      </div>

      {/* C. Rekapitulasi */}
      <SectionTitle no="C" title="Rekapitulasi" />
      <div className="mt-2 border-y-2 border-ink py-2.5">
        <MoneyRow k="Bruto" v={fmtRupiah(b.gross)} strong />
        <MoneyRow k="Total potongan" v={`−${fmtRupiah(totalPotongan)}`} neg strong />
        <div className="mt-1 flex items-center justify-between border-t border-ink pt-2.5">
          <span className="text-sm font-bold uppercase tracking-widest">Take-home pay</span>
          <span className="tnum font-mono text-lg font-bold text-official-deep">{fmtRupiah(b.net)}</span>
        </div>
      </div>

      {/* D. Kehadiran */}
      <SectionTitle no="D" title="Rekap Kehadiran" />
      <p className="tnum mt-2 font-mono text-xs text-ink-soft">
        Hari kerja {b.scheduledDays} · Hadir {b.attendedDays} · Alpha {b.alphaDays} · Lembur {b.overtimeHours} jam
        {slip.approvedAt && ` · Dibayarkan ${fmtDateTimeID(slip.approvedAt)}`}
      </p>

      {/* Tanda tangan & cap */}
      <div className="relative mt-10 grid grid-cols-2 gap-8 text-center">
        <div>
          <p className="text-xs text-ink-soft">Diterima oleh,</p>
          <div className="mx-auto mt-12 w-44 border-t border-ink pt-1">
            <p className="text-sm font-semibold">{employee?.name ?? "—"}</p>
            <p className="tnum font-mono text-[10px] text-ink-soft">NIK {employee?.nik ?? "—"}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-ink-soft">Ditetapkan oleh,</p>
          <div className="mx-auto mt-12 w-44 border-t border-ink pt-1">
            <p className="text-sm font-semibold">Bagian HR — Payroll</p>
          </div>
        </div>
        <span aria-hidden className="stamp stamp-approved absolute left-1/2 top-1 -translate-x-1/2 text-sm">
          Dibayar
        </span>
      </div>

      {/* Catatan kaki */}
      <p className="mt-8 border-t border-rule pt-2 text-[10px] leading-relaxed text-ink-faint">
        Dokumen ini dihasilkan oleh sistem HRIS pada {fmtDateID(todayISO())} sebagai bukti pembayaran resmi periode {formatPeriod(slip.period)}. Komputasi PPH21 memakai metode tahunan sederhana — silakan hubungi HR bila ada koreksi.
      </p>
    </article>
  );
}

function SectionTitle({ no, title }: { no: string; title: string }) {
  return (
    <p className="border-b border-rule pb-1 text-xs font-bold uppercase tracking-widest">
      <span className="mr-2 inline-flex h-4 w-4 items-center justify-center border border-ink font-mono text-[9px] leading-none">{no}</span>
      {title}
    </p>
  );
}

function Info({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-[10px] uppercase tracking-wider text-ink-soft">{k}</dt>
      <dd className={`text-xs font-semibold ${mono ? "tnum font-mono" : ""}`}>{v}</dd>
    </>
  );
}

function MoneyRow({ k, v, neg, strong }: { k: string; v: string; neg?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1 text-sm">
      <span className={strong ? "font-semibold" : "text-ink-soft"}>{k}</span>
      <span className={`tnum font-mono ${neg ? "text-stamp-deep" : ""} ${strong ? "font-semibold" : ""}`}>{v}</span>
    </div>
  );
}

function fmtNum(n: number): string {
  return n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Row({ k, v, bold, neg }: { k: string; v: string; bold?: boolean; neg?: boolean }) {
  return (
    <div className="flex justify-between py-2">
      <dt className={bold ? "font-semibold" : "text-ink-soft"}>{k}</dt>
      <dd className={`tnum font-mono ${neg ? "text-stamp-deep" : ""} ${bold ? "font-semibold" : ""}`}>{v}</dd>
    </div>
  );
}
