"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, LockSimpleOpen, Play } from "@phosphor-icons/react";
import { Btn, EmptyState, Input, PageHead, SignaturePad, Stamp } from "@/components/ui";
import { fmtRupiah } from "@/lib/format";
import type { PayrollBreakdown } from "@/lib/payroll";

interface RunSummary {
  id: string;
  period: string;
  status: string;
  slips: number;
}
interface Slip {
  employeeId: string;
  name: string;
  dept: string | null;
  breakdown: PayrollBreakdown;
}
interface RunDetail {
  run: { id: string; period: string; status: string; approvedBy?: string | null };
  slips: Slip[];
}

export default function AdminPayroll() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    const j = await fetch("/api/payroll/runs").then((r) => r.json());
    setRuns(j.runs ?? []);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/payroll/runs")
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        Promise.resolve(setRuns(j.runs ?? []));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [loadRuns]);

  async function openRun(id: string) {
    const j = await fetch(`/api/payroll/${id}`).then((r) => r.json());
    setDetail(j.run ? (j as RunDetail) : null);
  }

  async function compute() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/payroll/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      const j = await r.json();
      if (!r.ok) {
        setMsg(j.error ?? "Gagal menghitung payroll.");
        return;
      }
      setMsg(`Payroll ${j.period} dihitung untuk ${j.employees} karyawan.`);
      await loadRuns();
      await openRun(j.runId);
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!detail) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/payroll/${detail.run.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve: true }),
      });
      const j = await r.json();
      setMsg(r.ok ? `Periode ${detail.run.period} dikunci.` : (j.error ?? "Gagal approve."));
      await Promise.all([loadRuns(), openRun(detail.run.id)]);
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    if (!detail) return;
    const head = ["ID", "Nama", "Dept", "Terjadwal", "Hadir", "Alpha", "Bruto", "BPJS Kes", "BPJS JHT", "PPH21", "Net"];
    const rows = detail.slips.map((s) => [
      s.employeeId, s.name, s.dept ?? "-", s.breakdown.scheduledDays, s.breakdown.attendedDays,
      s.breakdown.alphaDays, s.breakdown.gross, s.breakdown.bpjsHealth, s.breakdown.bpjsJht,
      s.breakdown.tax, s.breakdown.net,
    ]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payroll-${detail.run.period}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const totals = detail?.slips.reduce(
    (acc, s) => ({
      gross: acc.gross + s.breakdown.gross,
      net: acc.net + s.breakdown.net,
    }),
    { gross: 0, net: 0 },
  );

  return (
    <>
      <PageHead
        title="Payroll"
        sub="Hitung gaji dari attendance tervalidasi + lembur disetujui. Approve mengunci periode."
        action={
          <Btn variant="secondary" icon={Download} onClick={exportCsv} disabled={!detail}>
            Export CSV
          </Btn>
        }
      />

      <div className="mb-5 flex flex-wrap items-end gap-2 border border-rule bg-card p-4">
        <div className="w-44">
          <label htmlFor="period" className="mb-1 block font-mono text-[11px] tracking-widest text-ink-faint uppercase">
            Periode
          </label>
          <Input id="period" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
        <Btn icon={Play} onClick={() => void compute()} disabled={busy}>
          {busy ? "Memproses…" : "Hitung Payroll"}
        </Btn>
        {msg && <p role="status" className="text-sm text-official">{msg}</p>}
      </div>

      {/* Daftar run */}
      {runs.length > 0 && (
        <section className="mb-6" aria-label="Riwayat payroll">
          <h2 className="mb-2 font-mono text-[11px] tracking-widest text-ink-faint uppercase">Riwayat Periode</h2>
          <ul className="divide-y divide-ledger/60 border border-rule bg-card">
            {runs.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => void openRun(r.id)}
                  className={`flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left hover:bg-black/[0.02] ${
                    detail?.run.id === r.id ? "border-l-4 border-l-official bg-official/5" : ""
                  }`}
                >
                  <span className="text-sm font-semibold">{r.period}</span>
                  <span className="flex items-center gap-3">
                    <span className="tnum font-mono text-xs text-ink-faint">{r.slips} slip</span>
                    <Stamp kind={r.status === "approved" ? "approved" : "pending"}>
                      {r.status === "approved" ? "Approved" : "Draft"}
                    </Stamp>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Detail run */}
      {!detail ? (
        runs.length === 0 ? (
          <EmptyState
            icon={LockSimpleOpen}
            title="Belum ada payroll"
            body="Pilih periode lalu tekan Hitung Payroll — sistem membaca roster, absensi tervalidasi, cuti dibayar, dan lembur disetujui."
          />
        ) : null
      ) : (
        <section aria-label={`Detail payroll ${detail.run.period}`}>
          <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold">
              Detail {detail.run.period}{" "}
              <span className="font-normal text-ink-soft">· {detail.slips.length} karyawan</span>
            </h2>
            {detail.run.status === "draft" ? (
              sig ? (
                <Btn variant="official" icon={LockSimpleOpen} onClick={() => void approve()} disabled={busy}>
                  Approve &amp; Kunci (tertanda)
                </Btn>
              ) : (
                <div className="w-80 border border-rule bg-card p-3"><p className="mb-2 text-xs font-semibold">Tanda tangan approver</p><SignaturePad onSave={setSig} /></div>
              )
            ) : (
              <Stamp kind="approved">Locked · {detail.run.approvedBy}</Stamp>
            )}
          </header>

          {totals && (
            <p className="tnum mb-3 font-mono text-xs text-ink-soft">
              Total bruto {fmtRupiah(totals.gross)} · total take-home {fmtRupiah(totals.net)}
            </p>
          )}

          <div className="overflow-x-auto border border-rule bg-card">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-rule font-mono text-[10px] tracking-widest text-ink-faint uppercase">
                  <Th>Karyawan</Th><Th>Dept</Th><Th num>Hadir</Th><Th num>Alpha</Th>
                  <Th num>Lembur</Th><Th num>Bruto</Th><Th num>Potongan</Th><Th num>Take-home</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ledger/50">
                {detail.slips.map((s) => (
                  <tr key={s.employeeId} className="hover:bg-black/[0.02]">
                    <td className="px-3 py-2">
                      <p className="font-medium">{s.name}</p>
                      <p className="tnum font-mono text-[10px] text-ink-faint">{s.employeeId}</p>
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-soft">{s.dept ?? "—"}</td>
                    <Num v={`${s.breakdown.attendedDays}/${s.breakdown.scheduledDays}`} />
                    <Num v={String(s.breakdown.alphaDays)} warn={s.breakdown.alphaDays > 0} />
                    <Num v={`${s.breakdown.overtimeHours}j`} />
                    <Num v={fmtRupiah(s.breakdown.gross)} />
                    <Num
                      v={fmtRupiah(s.breakdown.bpjsHealth + s.breakdown.bpjsJht + s.breakdown.tax + s.breakdown.alphaDeduction)}
                      warn
                    />
                    <td className="tnum px-3 py-2 font-mono font-semibold text-official">{fmtRupiah(s.breakdown.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            ponytail: PPH21 memakai metode tahunan dengan PTKP tunggal 54 jt tanpa status kawin/tanggungan —
            validasi ke konsultan pajak sebelum dipakai produksi.
          </p>
        </section>
      )}
    </>
  );
}

function Th({ children, num }: { children: React.ReactNode; num?: boolean }) {
  return <th className={`px-3 py-2 ${num ? "text-right" : "text-left"}`}>{children}</th>;
}

function Num({ v, warn }: { v: string; warn?: boolean }) {
  return <td className={`tnum px-3 py-2 text-right font-mono text-xs ${warn ? "text-stamp-deep" : ""}`}>{v}</td>;
}
