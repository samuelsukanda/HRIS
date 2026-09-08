"use client";

import { useMemo, useState } from "react";
import { CalendarBlank } from "@phosphor-icons/react";
import { Btn, EmptyState, Field, Input, StatusStamp, Textarea } from "@/components/ui";
import { formModal, toastOk } from "@/lib/swal";
import { addDays, fmtDateID, parseLocalISO, toLocalISO } from "@/lib/format";
import { currentUser, rosterShiftFor, todayISO, useHris } from "@/lib/store";

export default function EmployeeSchedule() {
  const { state, dispatch } = useHris();
  const me = currentUser(state);
  const today = todayISO();
  const monday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return toLocalISO(d);
  }, []);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);
  const rows = useMemo(() => days.map((d) => ({
    date: d,
    shift: me ? rosterShiftFor(state.data, me.employee.id, d) : null,
  })), [days, me, state.data]);
  const mySwaps = me ? state.data.shiftSwaps.filter((s) => s.employeeId === me.employee.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  if (!me) return null;

  return (
    <>
      <h1 className="mb-1 text-xl font-bold tracking-tight">Jadwal Saya</h1>
      <p className="mb-4 text-sm text-ink-soft">Roster minggu ini menurut buku jadwal departemen Anda.</p>

      {rows.every((r) => !r.shift) ? (
        <EmptyState icon={CalendarBlank} title="Minggu kosong" body="Belum ada roster untuk minggu ini. Hubungi supervisor bila ini tidak sesuai." />
      ) : (
        <ol className="space-y-2">
          {rows.map(({ date, shift }) => {
            const isToday = date === today;
            const isPast = parseLocalISO(date) < parseLocalISO(today);
            return (
              <li
                key={date}
                className={`flex items-center gap-4 border px-4 py-3 ${
                  isToday ? "border-stamp/40 bg-card" : "border-rule bg-card"
                } ${isPast ? "opacity-60" : ""}`}
              >
                <div className="w-24 shrink-0">
                  <p className={`text-sm font-semibold ${isToday ? "text-stamp-deep" : ""}`}>{fmtDateID(date).split(", ")[0]}</p>
                  <p className="tnum text-xs text-ink-faint">{fmtDateID(date).replace(/^\w+, /, "")}</p>
                </div>
                <div className="min-w-0 flex-1">
                  {shift ? (
                    <>
                      <p className="tnum font-mono text-lg leading-tight">
                        {shift.start}–{shift.end}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {shift.name} · grace {shift.graceMinutes} mnt
                        {shift.crossesMidnight ? " · lintas tengah malam" : ""}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm tracking-wide text-ink-faint uppercase">Libur</p>
                  )}
                </div>
                <button onClick={async () => {
                  const v = await formModal<{ target: string; reason: string }>(`Tukar shift ${date}`, [
                    { key: "target", label: "Shift tujuan (kosongkan = Off)", value: shift?.id ?? "" },
                    { key: "reason", label: "Alasan", value: "" },
                  ]);
                  if (!v) return;
                  dispatch({ type: "REQUEST_SHIFT_SWAP", swap: { id: `SWP-${Date.now().toString(36).toUpperCase()}`, employeeId: me.employee.id, date, fromShiftId: shift?.id ?? null, targetShiftId: v.target || null, reason: v.reason, status: "pending", createdAt: new Date().toISOString() } });
                  toastOk("Permintaan terkirim");
                }} className="min-h-9 px-2 text-[10px] font-semibold text-official hover:underline">Tukar</button>
                {isToday && (
                  <span aria-hidden className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-stamp" />
                    <span className="font-mono text-[10px] tracking-widest text-stamp-deep uppercase">Now</span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-5 px-1 text-xs leading-relaxed text-ink-faint">
        Window check-in dibuka ±60 menit dari jam mulai shift. Di luar window, ajukan koreksi
        di bawah.
      </p>
      {mySwaps.length > 0 && (
        <section className="mt-4" aria-label="Status tukar shift">
          <h2 className="mb-2 text-sm font-semibold">Status Tukar Shift</h2>
          <ul className="divide-y divide-ledger/60 border border-rule bg-card px-4">
            {mySwaps.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-ink-soft">{s.date} → {s.targetShiftId ?? "Off"}</span>
                <StatusStamp status={s.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="mt-4"><CorrectionForm /></div>
    </>
  );
}

function CorrectionForm(){
  const {state, showToast}=useHris();
  const me=currentUser(state);
  const [date,setDate]=useState(todayISO());
  const [reason,setReason]=useState("");
  const [after,setAfter]=useState("");
  const [busy,setBusy]=useState(false);
  async function submit(){
    if(!me||!reason.trim()) return;
    setBusy(true);
    const attId=`ATT-${date.replaceAll("-","")}-${me.employee.id}`;
    const r=await fetch(`/api/attendance/${attId}`,{method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({correction:{reason:reason.trim(), afterCheckIn: after||undefined}})});
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    showToast(j.ok ? "Koreksi diajukan" : (j.error ?? "Gagal"), j.ok ? "success":"error");
    if(j.ok){ setReason(""); setAfter(""); }
  }
  return (
    <section className="border border-rule bg-card p-4">
      <h3 className="text-sm font-semibold">Ajukan Koreksi Kehadiran</h3>
      <div className="mt-3 space-y-2">
        <Field label="Tanggal"><Input type="date" value={date} onChange={e=> setDate(e.target.value)} /></Field>
        <Field label="Jam Seharusnya (opsional)"><Input type="datetime-local" value={after} onChange={e=> setAfter(e.target.value)} /></Field>
        <Field label="Alasan"><Textarea value={reason} onChange={e=> setReason(e.target.value)} placeholder="Contoh: macet, salah pencatatan..." rows={2} /></Field>
        <Btn onClick={submit} disabled={busy||!reason.trim()}>{busy?"Mengirim...":"Kirim Koreksi"}</Btn>
      </div>
    </section>
  );
}
