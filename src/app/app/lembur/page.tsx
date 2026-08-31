"use client";
import { useState } from "react";
import { Clock } from "@phosphor-icons/react";
import { Btn, EmptyState, Field, Input, Textarea, StatusStamp } from "@/components/ui";
import { fmtDateShortID } from "@/lib/format";
import { currentUser, useHris } from "@/lib/store";

export default function EmployeeLembur() {
  const { state, dispatch } = useHris();
  const me = currentUser(state);
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("20:00");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  if (!me) return null;
  const my = state.data.overtimeRequests.filter(r=> r.employeeId===me.employee.id).sort((a,b)=> b.submittedAt.localeCompare(a.submittedAt));
  function submit(){
    setErr(null);
    if(!date||!start||!end) return setErr("Lengkapi tanggal dan jam.");
    if(end<=start) return setErr("Jam selesai harus setelah jam mulai.");
    if(reason.trim().length<10) return setErr("Alasan minimal satu kalimat.");
    const sh = Number(start.slice(0,2)), eh = Number(end.slice(0,2));
    const sm = Number(start.slice(3)), em = Number(end.slice(3));
    const hours = Math.round(((eh*60+em)-(sh*60+sm))/60*10)/10;
    dispatch({ type:"SUBMIT_OVERTIME", request:{ id:`OT-${String(state.data.overtimeRequests.length+100).padStart(3,"0")}`, employeeId: me!.employee.id, date, start, end, hours, reason:reason.trim(), status:"pending", submittedAt:new Date().toISOString() }});
    setReason("");
  }
  return <>
    <h1 className="mb-1 text-xl font-bold tracking-tight">Lembur</h1>
    <p className="mb-4 text-sm text-ink-soft">Ajukan lembur — akan direview atasan.</p>
    <section className="mb-6 border border-rule bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Clock size={16} weight="duotone" className="text-official" /> Pengajuan Baru</h2>
      <div className="space-y-3">
        <Field label="Tanggal"><Input type="date" value={date} onChange={e=> setDate(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mulai"><Input type="time" value={start} onChange={e=> setStart(e.target.value)} /></Field>
          <Field label="Selesai"><Input type="time" value={end} onChange={e=> setEnd(e.target.value)} /></Field>
        </div>
        <Field label="Alasan"><Textarea value={reason} onChange={e=> setReason(e.target.value)} placeholder="Contoh: deploy rilis mendesak..." /></Field>
        {err && <p role="alert" className="text-xs font-medium text-stamp-deep">{err}</p>}
        <Btn onClick={submit}>Kirim Pengajuan</Btn>
      </div>
    </section>
    <section>
      <h2 className="mb-2 text-sm font-semibold">Riwayat</h2>
      {my.length===0 ? <EmptyState icon={Clock} title="Belum ada pengajuan" body="Pengajuan lembur Anda akan muncul di sini." /> : (
        <ul className="divide-y divide-ledger/60 border border-rule bg-card px-4">
          {my.map(r=> (
            <li key={r.id} className="py-3">
              <div className="flex items-center justify-between"><p className="text-sm font-semibold">{fmtDateShortID(r.date)} · {r.start}–{r.end} · {r.hours} jam</p><StatusStamp status={r.status} /></div>
              <p className="mt-1 text-xs text-ink-faint">{r.reason}</p>
              {r.decidedBy && <p className="mt-1 text-xs text-ink-soft">Oleh {r.decidedBy}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  </>
}
