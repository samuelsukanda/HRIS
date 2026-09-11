"use client";

import { useState } from "react";
import { CalendarBlank, CaretLeft, CaretRight, Check, X } from "@phosphor-icons/react";
import { Avatar, Btn, EmptyState, PageHead, Pager, Select, Stamp, StatusStamp } from "@/components/ui";
import { toastOk } from "@/lib/swal";
import { leaveBalance } from "@/lib/engine";
import { fmtDateID, fmtDateShortID } from "@/lib/format";
import { currentUser, useHris } from "@/lib/store";

const BULAN_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return `${BULAN_ID[m - 1]} ${y}`;
}

export default function AdminCutiPage() {
  const { state, dispatch } = useHris();
  const { data } = state;
  const me = currentUser(state);
  const canDecide = !!me && me.user.role !== "employee";

  const [empId, setEmpId] = useState(data.employees[0]?.id ?? "");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"list"|"calendar">("list");
  const [calMonth, setCalMonth] = useState(()=> new Date().toISOString().slice(0,7));
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const LIMIT = 10;

  const requests = [...data.leaveRequests].filter(r=> !q.trim() || `${data.employees.find(e=> e.id===r.employeeId)?.name ?? ""} ${r.reason}`.toLowerCase().includes(q.toLowerCase())).sort(
    (a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1),
  );
  const paged = requests.slice((page - 1) * LIMIT, page * LIMIT);

  const annualType = data.leaveTypes.find((t) => /annual/i.test(t.name)) ?? data.leaveTypes[0];
  const balEmp = data.employees.find((e) => e.id === empId);
  const bal =
    annualType && balEmp
      ? leaveBalance(
          annualType.allocationDays,
          data.leaveRequests.filter((r) => r.employeeId === balEmp.id && r.typeId === annualType.id),
        )
      : null;

  function decide(id: string, approve: boolean) {
    if (!canDecide || !me) return;
    dispatch({ type: "DECIDE_LEAVE", id, approve, byName: me.employee.name });
    toastOk(approve ? "Cuti disetujui" : "Cuti ditolak");
  }

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAllPending() {
    const pendingIds = paged.filter((r) => r.status === "pending").map((r) => r.id);
    setSelected(pendingIds);
  }

  function bulkDecide(approve: boolean) {
    if (!canDecide || !me || selected.length === 0) return;
    dispatch({ type: "BULK_DECIDE_LEAVE", ids: selected, approve, byName: me.employee.name });
    toastOk(approve ? `${selected.length} cuti disetujui` : `${selected.length} cuti ditolak`);
    setSelected([]);
  }

  return (
    <>
      <PageHead
        title="Cuti"
        sub="Kelola pengajuan dan persetujuan cuti serta pantau saldo cuti karyawan."
      />
      <div className="mb-4 flex gap-2"><input value={q} onChange={e=> setQ(e.target.value)} placeholder="Cari nama/alasan..." className="flex-1 border border-rule bg-card px-3 py-2 text-sm" /><span className="text-xs text-ink-faint py-2">{requests.length} hasil</span><Btn variant={view==="list"?"primary":"secondary"} size="sm" onClick={()=> setView(view==="list"?"calendar":"list")}>{view==="list"?"Kalender":"List"}</Btn></div>
      {view==="calendar" && (
        <div className="mb-6 border border-rule bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button aria-label="Bulan sebelumnya" onClick={()=> setCalMonth(m=> { const d=new Date(m+"-01"); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7);})} className="btn-press inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[4px] border border-rule bg-card text-ink hover:border-ink-faint"><CaretLeft size={20} weight="bold" /></button>
            <span className="text-sm font-semibold">{monthLabel(calMonth)}</span>
            <button aria-label="Bulan berikutnya" onClick={()=> setCalMonth(m=> { const d=new Date(m+"-01"); d.setMonth(d.getMonth()+1); return d.toISOString().slice(0,7);})} className="btn-press inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[4px] border border-rule bg-card text-ink hover:border-ink-faint"><CaretRight size={20} weight="bold" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] text-ink-faint"><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span><span>Min</span></div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {(()=>{
              const [y,m]=calMonth.split("-").map(Number); const first=new Date(y,m-1,1); const startIdx=(first.getDay()+6)%7; const dim=new Date(y,m,0).getDate();
              return Array.from({length: startIdx+dim},(_,i)=> {
                if(i<startIdx) return <div key={`e-${i}`} />;
                const day=i-startIdx+1; const iso=`${calMonth}-${String(day).padStart(2,"0")}`;
                const dayLeaves=requests.filter(r=> r.startDate<=iso && iso<=r.endDate);
                return <div key={iso} className="min-h-14 border border-ledger/30 bg-paper p-1 text-left"><span className="font-mono text-xs">{day}</span>{dayLeaves.slice(0,2).map(r=> <span key={r.id} className="mt-0.5 block truncate rounded bg-stamp/10 px-1 py-0.5 text-[10px] text-stamp-deep">{data.employees.find(e=> e.id===r.employeeId)?.name.split(" ")[0]}</span>)}{dayLeaves.length>2 && <span className="text-[9px] text-ink-faint">+{dayLeaves.length-2}</span>}</div>;
              });
            })()}
          </div>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Daftar pengajuan */}
        <section className="border border-rule bg-card">
          <header className="flex items-baseline justify-between border-b border-rule px-5 py-3.5">
            <h2 className="font-semibold">Daftar Pengajuan</h2>
            <div className="flex items-center gap-3">
              {canDecide && selected.length > 0 && (
                <div className="flex gap-2">
                  <Btn variant="official" size="sm" icon={Check} onClick={() => bulkDecide(true)}>
                    Setujui {selected.length}
                  </Btn>
                  <Btn variant="danger" size="sm" icon={X} onClick={() => bulkDecide(false)}>
                    Tolak {selected.length}
                  </Btn>
                </div>
              )}
              <span className="tnum text-xs text-ink-faint">
                {requests.filter((r) => r.status === "pending").length} pending
              </span>
            </div>
          </header>
          {requests.length === 0 ? (
            <EmptyState
              icon={CalendarBlank}
              title="Belum ada pengajuan cuti"
              body="Pengajuan dari karyawan akan muncul di sini, pending selalu di atas."
            />
          ) : (
            <ul>
              {paged.map((r) => {
                const emp = data.employees.find((e) => e.id === r.employeeId);
                const type = data.leaveTypes.find((t) => t.id === r.typeId);
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-4 border-b border-ledger/60 px-5 py-3.5 last:border-b-0"
                  >
                    {canDecide && r.status === "pending" && (
                      <input
                        type="checkbox"
                        checked={selected.includes(r.id)}
                        onChange={() => toggleSelect(r.id)}
                        className="h-4 w-4 accent-official"
                      />
                    )}
                    <Avatar name={emp?.name ?? r.employeeId} src={emp?.photoUrl} />
                    <div className="min-w-[200px] flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="font-semibold">{emp?.name ?? r.employeeId}</p>
                        <span className="tnum text-xs text-ink-faint">{r.employeeId}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-ink-soft">
                        {type?.name ?? r.typeId} · <span className="tnum">{r.days} hari</span>
                      </p>
                      <p className="mt-1 max-w-[52ch] text-sm italic text-ink-faint">{r.reason}</p>
                      {r.attachmentUrl && (
                        <p className="mt-1 text-xs"><a href={r.attachmentUrl} target="_blank" rel="noreferrer" className="text-official underline">Lihat lampiran</a></p>
                      )}
                    </div>
                    <div className="text-sm">
                      <p className="tnum">
                        {r.startDate === r.endDate
                          ? fmtDateID(r.startDate)
                          : `${fmtDateShortID(r.startDate)} – ${fmtDateID(r.endDate)}`}
                      </p>
                    </div>
                    <StatusStamp status={r.status} />
                    {r.status === "pending" && canDecide && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Btn variant="official" size="sm" icon={Check} onClick={() => decide(r.id, true)}>
                          Setujui
                        </Btn>
                        <Btn variant="secondary" size="sm" icon={X} onClick={() => decide(r.id, false)}>
                          Tolak
                        </Btn>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <Pager page={page} total={requests.length} limit={LIMIT} onChange={setPage} />
        </section>

        {/* Panel samping */}
        <aside className="space-y-6">
          <section className="border border-rule bg-card">
            <header className="border-b border-rule px-5 py-3.5">
              <h2 className="font-semibold">Kebijakan Saldo</h2>
            </header>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs tracking-wide text-ink-faint uppercase">
                  <th className="px-5 py-2 font-semibold">Jenis Cuti</th>
                  <th className="py-2 pr-2 text-right font-semibold">Alokasi</th>
                  <th className="px-5 py-2 text-right font-semibold">Berbayar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ledger/60">
                {data.leaveTypes.map((t) => (
                  <tr key={t.id}>
                    <td className="px-5 py-2.5">{t.name}</td>
                    <td className="tnum py-2.5 pr-2 text-right">{t.allocationDays} hr</td>
                    <td className="px-5 py-2.5 text-right">
                      <Stamp kind={t.paid ? "approved" : "neutral"}>{t.paid ? "Paid" : "Unpaid"}</Stamp>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="border border-rule bg-card">
            <header className="border-b border-rule px-5 py-3.5">
              <h2 className="font-semibold">Saldo {annualType?.name ?? "Annual Leave"}</h2>
            </header>
            <div className="px-5 py-4">
              <EmployeeSearchSelect employees={data.employees} value={empId} onChange={setEmpId} />
              {bal && (
                <dl className="mt-4">
                  {([
                    ["Allocation", bal.allocation],
                    ["Used", bal.used],
                    ["Pending", bal.pending],
                    ["Remaining", bal.remaining],
                  ] as [string, number][]).map(([label, val]) => (
                    <div
                      key={label}
                      className={`flex items-baseline justify-between border-b border-ledger/60 py-2.5 ${
                        label === "Remaining" ? "border-b-0" : ""
                      }`}
                    >
                      <dt className="text-sm text-ink-soft">{label}</dt>
                      <dd
                        className={`tnum font-bold ${
                          label === "Remaining"
                            ? val < 0
                              ? "text-2xl text-stamp-deep"
                              : "text-2xl text-official-deep"
                            : "text-xl"
                        }`}
                      >
                        {val} <span className="text-xs font-medium text-ink-faint">hari</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

function EmployeeSearchSelect({ employees, value, onChange }: { employees: { id: string; name: string }[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = employees.find((e) => e.id === value);
  const filtered = q.trim()
    ? employees.filter((e) => `${e.name} ${e.id}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
    : employees.slice(0, 8);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setQ(""); }}
        aria-label="Pilih karyawan"
        aria-expanded={open}
        className="btn-press flex min-h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-[4px] border border-rule bg-card px-3 py-2 text-sm hover:border-ink-faint"
      >
        <span className="truncate">{selected ? `${selected.name} — ${selected.id}` : "Pilih karyawan…"}</span>
        <span className="shrink-0 text-xs text-ink-faint">▾</span>
      </button>
      {open && (
        <>
          <button aria-label="Tutup" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-[4px] border border-rule bg-card shadow-lg">
            <div className="border-b border-ledger/40 bg-paper px-2 py-2">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari nama / ID…"
                aria-label="Cari karyawan"
                className="w-full rounded-[4px] border border-rule bg-card px-2.5 py-1.5 text-sm outline-none placeholder:text-ink-faint focus:border-official"
              />
            </div>
            <ul className="max-h-52 overflow-auto py-1">
              {filtered.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => { onChange(e.id); setOpen(false); }}
                    className={`flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-black/[0.04] ${e.id === value ? "font-semibold text-official-deep" : ""}`}
                  >
                    <span className="truncate">{e.name}</span>
                    <span className="tnum shrink-0 text-xs text-ink-faint">{e.id}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-3 text-xs text-ink-faint">Tidak ada hasil</li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
