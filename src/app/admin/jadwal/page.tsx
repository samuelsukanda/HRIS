"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, MoonStars, Pencil, Trash } from "@phosphor-icons/react";
import { Btn, IconBtn, PageHead, Modal } from "@/components/ui";
import { confirmDelete, formModal, toastOk } from "@/lib/swal";
import { addDays, fmtDateID, parseLocalISO, toLocalISO } from "@/lib/format";
import { useHris } from "@/lib/store";

const SHIFT_CODE: Record<string, string> = { "S-PAGI": "P", "S-SIANG": "S", "S-MALAM": "M", "S-OFFICE": "OH" };
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

  const [shiftModal, setShiftModal] = useState(false);

  async function editShift(s: { id: string; name: string; start: string; end: string; graceMinutes: number }) {
    const v = await formModal<{ name: string; start: string; end: string; grace: string }>("Edit Shift", [
      { key: "name", label: "Nama shift", value: s.name },
      { key: "start", label: "Jam mulai (HH:MM)", value: s.start },
      { key: "end", label: "Jam selesai (HH:MM)", value: s.end },
      { key: "grace", label: "Toleransi absensi (menit)", value: String(s.graceMinutes), type: "number" },
    ], "name");
    if (!v || !v.name.trim()) return;
    dispatch({ type: "UPDATE_SHIFT", id: s.id, data: { name: v.name.trim(), start: v.start || s.start, end: v.end || s.end, graceMinutes: Number(v.grace) || s.graceMinutes } });
    toastOk("Shift disimpan");
  }

  async function deleteShift(s: { id: string; name: string }) {
    if (await confirmDelete(s.name)) {
      dispatch({ type: "DELETE_SHIFT", id: s.id });
      toastOk("Shift dihapus");
    }
  }

  return (
    <>
      <PageHead
        title="Jadwal & Shift"
        sub="Kelola jadwal kerja dan penugasan shift karyawan di seluruh lokasi."
      />

      {/* Toolbar sejajar: filter tanggal kiri, tambah shift kanan */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Btn variant="secondary" size="sm" icon={ArrowLeft} aria-label="Minggu sebelumnya" onClick={() => setWeekStart(addDays(weekStart, -7))} />
          <span className="tnum min-w-44 text-center text-sm font-semibold">
            {fmtDateID(days[0]!).replace(/^\w+, /, "")} — {fmtDateID(days[6]!).replace(/^\w+, /, "")}
          </span>
          <Btn variant="secondary" size="sm" icon={ArrowRight} aria-label="Minggu berikutnya" onClick={() => setWeekStart(addDays(weekStart, 7))} />
        </div>
        <Btn variant="official" size="sm" onClick={() => setShiftModal(true)}>+ Shift</Btn>
      </div>

      {/* Pola shift — kartu seragam, aksi selalu terlihat di footer */}
      <div className="mb-6 grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.shifts.map((s) => (
          <div key={s.id} className={`flex flex-col border p-4 ${s.crossesMidnight ? "border-stamp/30 bg-card" : "border-rule bg-card"}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold leading-snug">{s.name}</p>
              {s.crossesMidnight && (
                <span className="flex shrink-0 items-center gap-1 text-[10px] tracking-widest text-stamp-deep uppercase">
                  <MoonStars size={12} weight="fill" /> Midnight
                </span>
              )}
            </div>
            <p className="tnum mt-1 font-mono text-lg">
              {s.start}–{s.end}
            </p>
            <p className="mt-1 text-xs text-ink-faint">Toleransi absensi {s.graceMinutes} menit</p>
            <div className="mt-3 flex items-center justify-end gap-1 border-t border-ledger/40 pt-2.5">
              <IconBtn label={`Edit ${s.name}`} icon={Pencil} onClick={() => void editShift(s)} />
              <IconBtn label={`Hapus ${s.name}`} icon={Trash} onClick={() => void deleteShift(s)} className="hover:text-stamp" />
            </div>
          </div>
        ))}
      </div>
      <ShiftManager open={shiftModal} onClose={() => setShiftModal(false)} />

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

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-soft">
        <LegendSwatch code="OH" label="Office 09:00–17:00" cls="border-rule bg-paper text-ink-soft" />
        <LegendSwatch code="P" label="Pagi 07:00–15:00" cls="border-rule bg-paper text-ink-soft" />
        <LegendSwatch code="S" label="Siang 15:00–23:00" cls="border-rule bg-paper text-ink-soft" />
        <LegendSwatch code="M" label="Malam 23:00–07:00" cls="border-official bg-official/10 text-official-deep" />
      </div>

      <SwapReview />

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
                  toastOk("Jadwal diperbarui");
                } else {
                  if (entry) {
                    dispatch({ type: "DELETE_ROSTER", id: entry.id });
                    toastOk("Jadwal diliburkan");
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

function LegendSwatch({ code, label, cls }: { code: string; label: string; cls: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className={`tnum inline-flex h-6 min-w-8 items-center justify-center rounded-[3px] border px-1 pt-px font-mono text-xs font-semibold ${cls}`}>
        {code}
      </span>
      <span>{label}</span>
    </span>
  );
}

function SwapReview() {
  const { state, dispatch } = useHris();
  const pending = state.data.shiftSwaps.filter((s) => s.status === "pending");
  if (pending.length === 0) return null;
  const shiftName = (id: string | null) => id ? state.data.shifts.find((s) => s.id === id)?.name ?? id : "Off";
  return (
    <section className="mt-6 border border-rule bg-card">
      <header className="flex items-baseline justify-between border-b border-rule px-5 py-3.5">
        <h2 className="font-semibold">Permintaan Tukar Shift</h2>
        <span className="tnum text-xs text-ink-faint">{pending.length} pending</span>
      </header>
      <ul className="divide-y divide-ledger/50">
        {pending.map((s) => {
          const emp = state.data.employees.find((e) => e.id === s.employeeId);
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{emp?.name ?? s.employeeId} <span className="tnum font-normal text-ink-faint">· {s.date}</span></p>
                <p className="text-xs text-ink-soft">{shiftName(s.fromShiftId)} → {shiftName(s.targetShiftId)}{s.reason ? ` · ${s.reason}` : ""}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Btn variant="official" size="sm" onClick={() => { dispatch({ type: "DECIDE_SHIFT_SWAP", id: s.id, approve: true }); toastOk("Tukar shift disetujui"); }}>Setujui</Btn>
                <Btn variant="secondary" size="sm" onClick={() => { dispatch({ type: "DECIDE_SHIFT_SWAP", id: s.id, approve: false }); toastOk("Tukar shift ditolak"); }}>Tolak</Btn>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ShiftManager({ open, onClose }: { open: boolean; onClose: () => void }){
  const {dispatch}=useHris();
  const [form,setForm]=useState({ name:"", start:"09:00", end:"17:00", graceMinutes:15 });
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="Shift Baru">
      <div className="space-y-5">
        <label className="block text-xs font-semibold tracking-wide text-ink-soft uppercase">Nama<input value={form.name} onChange={e=> setForm({...form,name:e.target.value})} placeholder="Contoh: Shift Pagi" className="mt-2 w-full border border-rule bg-paper px-3 py-2 text-sm" /></label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block text-xs font-semibold tracking-wide text-ink-soft uppercase">Mulai<input type="time" value={form.start} onChange={e=> setForm({...form,start:e.target.value})} className="mt-2 w-full border border-rule bg-paper px-3 py-2 text-sm" /></label>
          <label className="block text-xs font-semibold tracking-wide text-ink-soft uppercase">Selesai<input type="time" value={form.end} onChange={e=> setForm({...form,end:e.target.value})} className="mt-2 w-full border border-rule bg-paper px-3 py-2 text-sm" /></label>
          <label className="block text-xs font-semibold tracking-wide text-ink-soft uppercase">Toleransi absensi<input type="number" value={form.graceMinutes} onChange={e=> setForm({...form,graceMinutes:Number(e.target.value)})} className="mt-2 w-full border border-rule bg-paper px-3 py-2 text-sm" /></label>
        </div>
        <div className="flex gap-2 border-t border-ledger/40 pt-4">
          <Btn onClick={()=> { if(!form.name.trim()) return; const id=`S-${form.name.toUpperCase().replace(/\s+/g,"")}-${Date.now()}`; dispatch({type:"CREATE_SHIFT", shift:{ id, name:form.name.trim(), start:form.start, end:form.end, graceMinutes:form.graceMinutes, crossesMidnight: form.end < form.start }}); onClose(); setForm({ name:"", start:"09:00", end:"17:00", graceMinutes:15 }); toastOk("Shift ditambahkan"); }}>Simpan</Btn>
          <Btn variant="ghost" onClick={onClose}>Batal</Btn>
        </div>
      </div>
    </Modal>
  );
}
