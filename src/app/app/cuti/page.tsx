"use client";

import { useState } from "react";
import { HandHeart } from "@phosphor-icons/react";
import { Btn, EmptyState, Field, Input, Select, Stamp, StatusStamp, Textarea } from "@/components/ui";
import { leaveBalance } from "@/lib/engine";
import { fmtDateShortID } from "@/lib/format";
import { currentUser, useHris } from "@/lib/store";

export default function EmployeeLeave() {
  const { state, dispatch } = useHris();
  const me = currentUser(state);
  const [typeId, setTypeId] = useState("LV-CT");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  if (!me) return null;
  const { employee } = me;

  const myRequests = state.data.leaveRequests
    .filter((r) => r.employeeId === employee.id)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  function submit() {
    setFormError(null);
    const type = state.data.leaveTypes.find((t) => t.id === typeId);
    if (!type) return setFormError("Jenis cuti tidak tersedia.");
    if (!start || !end) return setFormError("Tanggal mulai dan selesai wajib diisi.");
    if (end < start) return setFormError("Tanggal selesai tidak boleh sebelum tanggal mulai.");
    const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1;
    const bal = leaveBalance(type.allocationDays, myRequests.filter((r) => r.typeId === typeId));
    if (type.paid && bal.remaining < days)
      return setFormError(`Saldo ${type.name} tinggal ${Math.max(0, bal.remaining)} hari — kurang untuk ${days} hari.`);
    if (reason.trim().length < 10) return setFormError("Tuliskan alasan minimal satu kalimat.");
    dispatch({
      type: "SUBMIT_LEAVE",
      request: {
        id: `LRV-${String(state.data.leaveRequests.length + 100).padStart(3, "0")}`,
        employeeId: employee.id,
        typeId,
        startDate: start,
        endDate: end,
        days,
        reason: reason.trim(),
        status: "pending",
        submittedAt: new Date().toISOString(),
        ...(attachmentUrl ? { attachmentUrl } : {}),
      },
    });
    setStart("");
    setEnd("");
    setReason("");
    setAttachmentUrl("");
  }

  return (
    <>
      <h1 className="mb-1 text-xl font-bold tracking-tight">Cuti &amp; Izin</h1>
      <p className="mb-4 text-sm text-ink-soft">Ajukan cuti dan pantau saldonya — persis seperti buku cuti tahunan.</p>

      {/* Saldo per jenis */}
      <section aria-label="Saldo cuti" className="mb-6 border border-rule bg-card">
        <header className="border-b border-rule px-4 py-2.5">
          <h2 className="text-sm font-semibold">Buku Saldo</h2>
        </header>
        <ul className="px-4">
          {state.data.leaveTypes.slice(0, 5).map((t) => {
            const bal = leaveBalance(t.allocationDays, myRequests.filter((r) => r.typeId === t.id));
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 border-b border-ledger/50 py-2.5 last:border-b-0">
                <span className="min-w-0 truncate text-sm">{t.name}</span>
                <span className="tnum shrink-0 font-mono text-sm">
                  <b>{bal.remaining}</b>
                  <span className="text-ink-faint"> / {t.allocationDays}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Form pengajuan */}
      <section aria-label="Ajukan cuti" className="mb-6 border border-rule bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <HandHeart size={16} weight="duotone" className="text-stamp" /> Pengajuan Baru
        </h2>
        <div className="space-y-3">
          <Field label="Jenis Cuti">
            <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              {state.data.leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.requiresAttachment ? " (lampiran dokumen)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mulai">
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="Selesai">
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} min={start || undefined} />
            </Field>
          </div>
          <Field label="Alasan" hint="Satu kalimat cukup. Lampiran dokmen menyusul via HR bila diminta.">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Contoh: acara keluarga di luar kota…" />
          </Field>
          <Field label="Lampiran (opsional)" hint="JPG/PNG/PDF max 2MB">
            <Input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={async e=> {
              const f=e.target.files?.[0];
              if(!f) return;
              if(f.size>2*1024*1024){ setFormError("File max 2MB"); return; }
              setFormError(null);
              const fd=new FormData(); fd.append("file", f);
              try {
                const r=await fetch("/api/uploads",{method:"POST",body:fd});
                const j=await r.json() as {ok:boolean;url?:string;error?:string};
                if(j.ok && j.url){ setAttachmentUrl(j.url); }
                else setFormError(j.error ?? "Upload gagal.");
              } catch { setFormError("Upload gagal. Coba lagi."); }
              e.target.value="";
            }} />
            {attachmentUrl && <p className="mt-1 text-xs text-official-deep">Terlampir: <a href={attachmentUrl} target="_blank" rel="noreferrer" className="underline">{attachmentUrl.split("/").pop()}</a> <button type="button" onClick={()=> setAttachmentUrl("")} className="ml-1 text-stamp hover:underline">hapus</button></p>}
          </Field>
          {formError && (
            <p role="alert" className="text-xs font-medium text-stamp-deep">
              {formError}
            </p>
          )}
          <Btn onClick={submit}>Kirim Pengajuan</Btn>
        </div>
      </section>

      {/* Riwayat */}
      <section aria-label="Riwayat cuti">
        <h2 className="mb-2 text-sm font-semibold">Riwayat</h2>
        {myRequests.length === 0 ? (
          <EmptyState icon={HandHeart} title="Belum ada pengajuan" body="Pengajuan cuti Anda akan muncul di sini beserta keputusan atasan." />
        ) : (
          <ul className="divide-y divide-ledger/60 border border-rule bg-card px-4">
            {myRequests.map((r) => {
              const type = state.data.leaveTypes.find((t) => t.id === r.typeId);
              return (
                <li key={r.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{type?.name ?? "Cuti"}</p>
                    <StatusStamp status={r.status} />
                  </div>
                  <p className="tnum mt-0.5 text-xs text-ink-soft">
                    {fmtDateShortID(r.startDate)}
                    {r.endDate !== r.startDate ? ` – ${fmtDateShortID(r.endDate)}` : ""} · {r.days} hari
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-faint">{r.reason}</p>
                  {r.attachmentUrl && (
                    <p className="mt-1 text-xs"><a href={r.attachmentUrl} target="_blank" rel="noreferrer" className="text-official underline">Lihat lampiran</a></p>
                  )}
                  {r.status === "rejected" && r.decidedBy && (
                    <p className="mt-1 text-xs text-stamp-deep">Ditolak oleh {r.decidedBy}</p>
                  )}
                  {r.status === "pending" && (
                    <Btn variant="danger" size="sm" onClick={() => dispatch({ type: "CANCEL_LEAVE", id: r.id })} className="mt-2">
                      Batalkan Pengajuan
                    </Btn>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-4 flex items-center gap-2 px-1 text-xs text-ink-faint">
        <Stamp kind="pending">Pending</Stamp> berarti menunggu keputusan supervisor &amp; HR.
      </div>
    </>
  );
}
