"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, MoonStars } from "@phosphor-icons/react";
import { Btn, IconBtn, PageHead, Modal } from "@/components/ui";
import { addDays, fmtDateID, parseLocalISO, toLocalISO } from "@/lib/format";
import { useHris } from "@/lib/store";

const SHIFT_CODE: Record<string, string> = { "S-PAGI": "P", "S-SIANG": "S", "S-MALAM": "M", "S-OFFICE": "O" };
const SHIFT_LABEL: Record<string, string> = {
  "S-PAGI": "Pagi",
  "S-SIANG": "Siang",
  "S-MALAM": "Malam",
  "S-OFFICE": "Office",
};

export default function AdminSchedule() {
  const { state, dispatch } = useHris();
  const { data } = state;
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Senin
    return toLocalISO(d);
  });
  const today = useMemo(() => toLocalISO(new Date()), []);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const [editCell, setEditCell] = useState<{ employeeId: string; date: string; currentShiftId: string | null } | null>(null);

  const activeEmployees = data.employees.filter((e) => e.status === "active");
  const isCurrentWeekVisible =
    new Date(weekStart) <= parseLocalISO(today) && parseLocalISO(today) <= parseLocalISO(addDays(weekStart, 6));

  return (
    <>
      <PageHead
        title="Jadwal & Shift"
        sub="Papan roster mingguan seluruh lokasi. Klik kotak jadwal untuk mengubah/menugaskan shift karyawan."
        action={
          <div className="flex items-center gap-2">
            <Btn variant="secondary" icon={ArrowLeft} aria-label="Minggu sebelumnya" onClick={() => setWeekStart(addDays(weekStart, -7))} className="px-2.5" />
            <span className="tnum min-w-44 text-center text-sm font-semibold">
              {fmtDateID(days[0]!).replace(/^\w+, /, "")} — {fmtDateID(days[6]!).replace(/^\w+, /, "")}
            </span>
            <Btn variant="secondary" icon={ArrowRight} aria-label="Minggu berikutnya" onClick={() => setWeekStart(addDays(weekStart, 7))} className="px-2.5" />
          </div>
        }
      />

      {/* Pola shift — with CRUD */}
      <ShiftManager />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.shifts.map((s) => (
          <div key={s.id} className={`group border p-4 ${s.crossesMidnight ? "border-stamp/30 bg-card" : "border-rule bg-card"}`}>
            <p className="flex items-center justify-between gap-2 text-sm font-semibold">
              <span>{s.name}</span>
              <span className="flex items-center gap-1">
                {s.crossesMidnight && <span className="flex items-center gap-1 text-[10px] tracking-widest text-stamp-deep uppercase"><MoonStars size={12} weight="fill" /> Midnight</span>}
                <Btn variant="ghost" size="sm" onClick={()=> { const n=prompt("Nama shift",s.name); if(!n) return; const st=prompt("Jam mulai (HH:MM)",s.start) ?? s.start; const en=prompt("Jam selesai",s.end) ?? s.end; const gr=Number(prompt("Grace menit",String(s.graceMinutes)) ?? s.graceMinutes); dispatch({type:"UPDATE_SHIFT", id:s.id, data:{ name:n, start:st, end:en, graceMinutes:gr }}); }} className="opacity-0 group-hover:opacity-100">Edit</Btn>
                <Btn variant="ghost" size="sm" onClick={()=> { if(confirm(`Hapus ${s.name}?`)) dispatch({type:"DELETE_SHIFT", id:s.id}); }} className="opacity-0 group-hover:opacity-100 text-stamp">Hapus</Btn>
              </span>
            </p>
            <p className="tnum mt-1 font-mono text-lg">
              {s.start}–{s.end}
            </p>
            <p className="mt-1 text-xs text-ink-faint">Grace period {s.graceMinutes} menit</p>
          </div>
        ))}
      </div>

      {/* Papan roster */}
      <div className="overflow-x-auto border border-rule bg-card">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-rule bg-card px-4 py-2.5 text-left font-mono text-[11px] tracking-widest text-ink-faint uppercase">
                Karyawan
              </th>
              {days.map((d) => {
                const date = parseLocalISO(d);
                const isToday = d === today;
                return (
                  <th
                    key={d}
                    className={`border-b border-l border-ledger/50 px-1 py-2 text-center font-mono text-[11px] tracking-wide uppercase ${
                      isToday && isCurrentWeekVisible ? "bg-paper" : ""
                    }`}
                  >
                    <span className={isToday ? "text-stamp-deep" : "text-ink-faint"}>{date.toLocaleDateString("id-ID", { weekday: "short" })}</span>{" "}
                    <span className="tnum">{date.getDate()}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {activeEmployees.map((emp) => (
              <tr key={emp.id} className="group">
                <td className="sticky left-0 z-10 border-b border-ledger/40 bg-card px-4 py-1.5 group-hover:bg-paper">
                  <span className="block truncate text-[13px] font-medium">{emp.name}</span>
                  <span className="tnum block text-[10px] text-ink-faint">{emp.id}</span>
                </td>
                {days.map((d) => {
                  const entry = data.roster.find((r) => r.employeeId === emp.id && r.date === d);
                  const sid = entry?.shiftId ?? null;
                  const isToday = d === today && isCurrentWeekVisible;
                  return (
                    <td
                      key={d}
                      className={`relative border-b border-l border-ledger/40 px-1 py-1.5 text-center ${isToday ? "bg-paper" : ""}`}
                    >
                      <button
                        onClick={() => setEditCell({ employeeId: emp.id, date: d, currentShiftId: sid })}
                        aria-label={`Ubah shift ${emp.name} pada ${d}`}
                        className="btn-press"
                      >
                        {sid ? (
                          <span
                            title={`${SHIFT_LABEL[sid]} · ${data.shifts.find((s) => s.id === sid)?.start}–${data.shifts.find((s) => s.id === sid)?.end}`}
                            className={`tnum inline-block h-6 w-8 cursor-help rounded-[3px] border pt-0.5 font-mono text-xs font-semibold ${
                              sid === "S-MALAM"
                                ? "border-official bg-official/10 text-official-deep"
                                : "border-rule bg-paper text-ink-soft group-hover:border-ink-faint"
                            }`}
                          >
                            {SHIFT_CODE[sid]}
                          </span>
                        ) : (
                          <span className="tnum inline-block h-6 w-8 rounded-[3px] border border-rule bg-paper text-[9px] leading-6 text-ink-faint uppercase hover:border-ink-soft">
                            Off
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
        <LegendSwatch label="O Office 09:00–17:00" cls="border-rule bg-paper text-ink-soft" />
        <LegendSwatch label="P Pagi 07:00–15:00" cls="border-rule bg-paper text-ink-soft" />
        <LegendSwatch label="S Siang 15:00–23:00" cls="border-rule bg-paper text-ink-soft" />
        <LegendSwatch label="M Malam 23:00–07:00" cls="border-official bg-official/10 text-official-deep" />
      </p>

      {/* Edit Roster Cell Modal */}
      {editCell && (
        <Modal open={!!editCell} onClose={() => setEditCell(null)} title="Tugaskan Shift">
          <div className="space-y-3">
            <p className="text-xs text-ink-soft">
              Pilih shift kerja untuk <strong>{data.employees.find((e) => e.id === editCell.employeeId)?.name}</strong> tanggal {editCell.date}.
            </p>
            <select
              value={editCell.currentShiftId || ""}
              aria-label="Pilih Shift"
              onChange={(e) => {
                const shiftId = e.target.value || null;
                const entry = data.roster.find((r) => r.employeeId === editCell.employeeId && r.date === editCell.date);
                if (shiftId) {
                  if (entry) {
                    dispatch({ type: "UPDATE_ROSTER", id: entry.id, data: { shiftId } });
                  } else {
                    const newId = "RST-" + Math.random().toString(36).slice(2, 10);
                    dispatch({ type: "CREATE_ROSTER", roster: { id: newId, employeeId: editCell.employeeId, date: editCell.date, shiftId } });
                  }
                } else {
                  if (entry) {
                    dispatch({ type: "DELETE_ROSTER", id: entry.id });
                  }
                }
                setEditCell(null);
              }}
              className="w-full border border-rule bg-card px-3 py-2 text-sm focus:outline-none"
            >
              <option value="">Off (Libur)</option>
              {data.shifts.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.start}–{s.end})</option>
              ))}
            </select>
          </div>
        </Modal>
      )}
    </>
  );
}

function LegendSwatch({ label, cls }: { label: string; cls: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={`tnum inline-block h-4 w-6 rounded-[2px] border font-mono text-[9px] leading-4 ${cls}`}>
        ·
      </span>
      {label}
    </span>
  );
}

function ShiftManager(){
  const {state,dispatch}=useHris();
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState({ name:"", start:"09:00", end:"17:00", graceMinutes:15 });
  return (
    <div className="mb-4 flex justify-end">
      <Btn onClick={()=> setOpen(true)}>+ Shift</Btn>
      {open && (
        <Modal open={open} onClose={()=> setOpen(false)} title="Shift Baru">
          <div className="space-y-3">
            <label className="text-xs">Nama<input value={form.name} onChange={e=> setForm({...form,name:e.target.value})} className="mt-1 w-full border border-rule bg-paper px-2 py-1.5 text-sm" /></label>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs">Mulai<input type="time" value={form.start} onChange={e=> setForm({...form,start:e.target.value})} className="mt-1 w-full border border-rule bg-paper px-2 py-1.5 text-sm" /></label>
              <label className="text-xs">Selesai<input type="time" value={form.end} onChange={e=> setForm({...form,end:e.target.value})} className="mt-1 w-full border border-rule bg-paper px-2 py-1.5 text-sm" /></label>
              <label className="text-xs">Grace<input type="number" value={form.graceMinutes} onChange={e=> setForm({...form,graceMinutes:Number(e.target.value)})} className="mt-1 w-full border border-rule bg-paper px-2 py-1.5 text-sm" /></label>
            </div>
            <Btn onClick={()=> { if(!form.name) return; const id=`S-${form.name.toUpperCase().replace(/\s+/g,"")}-${Date.now()}`; dispatch({type:"CREATE_SHIFT", shift:{ id, name:form.name, start:form.start, end:form.end, graceMinutes:form.graceMinutes, crossesMidnight: form.end < form.start }}); setOpen(false); setForm({ name:"", start:"09:00", end:"17:00", graceMinutes:15 }); }}>Simpan</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
