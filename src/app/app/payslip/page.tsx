"use client";

import { useEffect, useState } from "react";
import { CaretDown, Wallet } from "@phosphor-icons/react";
import { EmptyState, PageHead, Stamp } from "@/components/ui";
import { fmtRupiah } from "@/lib/format";
import type { PayrollBreakdown } from "@/lib/payroll";

interface Slip {
  period: string;
  approvedAt: string | null;
  breakdown: PayrollBreakdown;
}

export default function MyPayslips() {
  const [slips, setSlips] = useState<Slip[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/payroll/mine")
      .then((r) => r.json())
      .then((j) => setSlips(j.slips ?? []))
      .catch(() => setSlips([]));
  }, []);

  return (
    <>
      <PageHead title="Slip Gaji" sub="Riwayat gaji bulanan yang sudah dikunci payroll." />
      {slips === null ? (
        <p className="tnum animate-pulse font-mono text-sm text-ink-faint">Memuat…</p>
      ) : slips.length === 0 ? (
        <EmptyState icon={Wallet} title="Belum ada slip" body="Slip muncul setelah HR menjalankan dan menyetujui payroll periode berjalan." />
      ) : (
        <ul className="space-y-3 print:space-y-6">
          {slips.map((s) => {
            const isOpen = open === s.period;
            return (
              <li key={s.period} className="border border-rule bg-card print:break-inside-avoid">
                <button
                  onClick={() => setOpen(isOpen ? null : s.period)}
                  aria-expanded={isOpen}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-black/[0.02] print:hidden"
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
                <div className="hidden px-4 py-3 print:block">
                  <p className="text-sm font-bold">{formatPeriod(s.period)}</p>
                  <p className="tnum mt-0.5 font-mono text-xs text-ink-soft">Take-home {fmtRupiah(s.breakdown.net)}</p>
                </div>
                <div className={`${isOpen ? "" : "hidden"} print:block`}>
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
      {slips !== null && slips.length > 0 && (
        <button onClick={() => window.print()} className="btn-press mt-4 w-full cursor-pointer rounded-[4px] border border-rule bg-card px-4 py-2.5 text-sm font-semibold hover:border-ink-faint print:hidden">
          Cetak / Simpan PDF
        </button>
      )}
    </>
  );
}

function formatPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const nama = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return `${nama[(m ?? 1) - 1]} ${y}`;
}

function Row({ k, v, bold, neg }: { k: string; v: string; bold?: boolean; neg?: boolean }) {
  return (
    <div className="flex justify-between py-2">
      <dt className={bold ? "font-semibold" : "text-ink-soft"}>{k}</dt>
      <dd className={`tnum font-mono ${neg ? "text-stamp-deep" : ""} ${bold ? "font-semibold" : ""}`}>{v}</dd>
    </div>
  );
}
