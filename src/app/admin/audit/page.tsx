"use client";

import { useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Btn, EmptyState, Input, PageHead, Pager } from "@/components/ui";
import { useHris } from "@/lib/store";

const MONS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function fmtStamp(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${MONS[d.getMonth()]} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const COLS = "grid-cols-[110px_160px_190px_160px_1fr] gap-x-4";
const ROW = `grid ${COLS}`;

export default function AdminAuditPage() {
  const { state } = useHris();
  const { data } = state;
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  const needle = q.trim().toLowerCase();
  const logs = data.auditLogs.filter(e=> {
    if(needle && ![e.actorName, e.action, e.detail, e.targetId].some(v=> v.toLowerCase().includes(needle))) return false;
    if(from && e.at.slice(0,10) < from) return false;
    if(to && e.at.slice(0,10) > to) return false;
    return true;
  });
  const paged = logs.slice((page - 1) * LIMIT, page * LIMIT);
  function exportCsv(){
    const header=["Waktu","Aktor","Action","Target","Detail","Before","After"].join(",");
    const rows=logs.map(e=> [e.at,e.actorName,e.action,`${e.targetType}#${e.targetId}`,e.detail,e.before??"",e.after??""].map(v=> `"${String(v).replace(/"/g,'""')}"`).join(","));
    const csv="\uFEFF"+[header,...rows].join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    const a=document.createElement("a"); a.href=url; a.download=`audit-${from||"all"}-${to||"all"}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHead
        title="Audit Log"
        sub="Setiap keputusan dan perubahan data tercatat permanen — termasuk jejak nilai before → after untuk auditabilitas penuh."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Input type="search" value={q} onChange={ev=> setQ(ev.target.value)} placeholder="Cari aktor/action..." aria-label="Cari audit log" className="flex-1 min-w-52" />
        <Input type="date" value={from} onChange={e=> setFrom(e.target.value)} aria-label="Dari" className="w-36" />
        <Input type="date" value={to} onChange={e=> setTo(e.target.value)} aria-label="Sampai" className="w-36" />
        <Btn variant="secondary" size="sm" onClick={exportCsv}>Export CSV</Btn>
      </div>

      <section className="border border-rule bg-card">
        <header className="flex items-baseline justify-between border-b border-rule px-5 py-3.5">
          <h2 className="font-semibold">Registri Perubahan</h2>
          <span className="tnum text-xs text-ink-faint">
            {logs.length}/{data.auditLogs.length} entri
          </span>
        </header>
        {logs.length === 0 ? (
          <EmptyState
            icon={MagnifyingGlass}
            title="Tidak ada entri yang cocok"
            body="Ubah kata kunci pencarian atau kosongkan filter untuk melihat seluruh jejak audit."
          />
        ) : (
          <div className="overflow-x-auto">
            <div className={`min-w-[900px] border-b border-rule bg-paper px-5 py-2 text-[11px] font-semibold tracking-wider text-ink-faint uppercase ${ROW}`}>
              <span>Waktu</span>
              <span>Aktor</span>
              <span>Action</span>
              <span>Target</span>
              <span>Detail</span>
            </div>
            {/* data.auditLogs sudah terurut terbaru di atas */}
            <ul className="divide-y divide-ledger/60 font-mono text-[13px]">
              {paged.map((e) => (
                <li key={e.id} className={`${ROW} px-5 py-3`}>
                  <span className="tnum whitespace-nowrap text-ink-soft">{fmtStamp(e.at)}</span>
                  <span className="truncate font-semibold" title={e.actorName}>{e.actorName}</span>
                  <span className="text-official-deep">{e.action}</span>
                  <span className="truncate text-ink-soft">
                    {e.targetType} <span className="text-ink-faint">#{e.targetId}</span>
                  </span>
                  <span className="min-w-0 text-ink-soft">
                    {e.detail}
                    {(e.before !== undefined || e.after !== undefined) && (
                      <span className="tnum mt-0.5 block text-xs text-ink-faint">
                        {e.before ?? "—"} → {e.after ?? "—"}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <Pager page={page} total={logs.length} limit={LIMIT} onChange={setPage} />
    </>
  );
}
