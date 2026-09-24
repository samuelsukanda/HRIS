"use client";

import { useState } from "react";
import { Check, Clock, Plus, X } from "@phosphor-icons/react";
import { Btn, EmptyState, Field, Input, Modal, PageHead, Pager, StatusStamp, Textarea } from "@/components/ui";
import { toastOk } from "@/lib/swal";
import { fmtDateShortID } from "@/lib/format";
import { currentUser, todayISO, useHris } from "@/lib/store";

export default function AdminLemburPage() {
  const { state, dispatch } = useHris();
  const { data } = state;
  const me = currentUser(state);

  function getApprovalLevel(emp: { spvId?: string; managerId?: string }): "spv" | "manager" | null {
    if (!me) return null;
    if (emp.spvId === me.employee.id) return "spv";
    if (emp.managerId === me.employee.id) return "manager";
    return null;
  }

  function canDecideOvertime(r: { status: string; employeeId: string }): boolean {
    if (!me) return false;
    const emp = data.employees.find((e) => e.id === r.employeeId);
    if (!emp) return false;
    const level = getApprovalLevel(emp);
    if (!level) return false;
    if (level === "spv" && r.status === "pending") return true;
    if (level === "manager" && r.status === "spv_approved") return true;
    if (level === "manager" && r.status === "pending" && !emp.spvId) return true;
    return false;
  }

  /** Pending hanya terlihat oleh SPV-nya (HR/super admin tetap lihat semua). */
  function canSeeOvertime(r: { status: string; employeeId: string }): boolean {
    if (r.status !== "pending") return true;
    if (me?.user.role === "hr" || me?.user.role === "super_admin") return true;
    const emp = data.employees.find((e) => e.id === r.employeeId);
    if (!emp || !me) return false;
    if (emp.spvId === me.employee.id) return true;
    if (!emp.spvId && emp.managerId === me.employee.id) return true;
    return false;
  }

  const monthPrefix = todayISO().slice(0, 7);
  const approvedThisMonth = data.overtimeRequests.filter(
    (r) => r.status === "approved" && r.date.startsWith(monthPrefix),
  );
  const otHours = approvedThisMonth.reduce((s, r) => s + r.hours, 0);
  const pending = data.overtimeRequests.filter((r) => canSeeOvertime(r) && (r.status === "pending" || r.status === "spv_approved"));

  const nameOf = (id: string) => data.employees.find((e) => e.id === id)?.name ?? id;
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 10;
  const filtered = data.overtimeRequests
    .filter((r) => canSeeOvertime(r))
    .filter((r) => !q.trim() || `${nameOf(r.employeeId)} ${r.reason}`.toLowerCase().includes(q.toLowerCase()))
    .sort(
      (a, b) =>
        ((a.status === "pending" || a.status === "spv_approved") ? 0 : 1) -
        ((b.status === "pending" || b.status === "spv_approved") ? 0 : 1),
    );
  const paged = filtered.slice((page - 1) * LIMIT, page * LIMIT);

  function decide(id: string, approve: boolean) {
    if (!me) return;
    dispatch({ type: "DECIDE_OVERTIME", id, approve, byName: me.employee.name });
    toastOk(approve ? "Lembur disetujui" : "Lembur ditolak");
  }

  // Tambah pengajuan untuk diri sendiri (tanpa pilih karyawan)
  const [showAdd, setShowAdd] = useState(false);
  const [addDate, setAddDate] = useState(todayISO());
  const [addStart, setAddStart] = useState("18:00");
  const [addEnd, setAddEnd] = useState("20:00");
  const [addReason, setAddReason] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  function openAdd() {
    setAddDate(todayISO());
    setAddStart("18:00");
    setAddEnd("20:00");
    setAddReason("");
    setAddError(null);
    setShowAdd(true);
  }

  function submitAdd() {
    setAddError(null);
    if (!me) return;
    if (!addDate || !addStart || !addEnd) return setAddError("Lengkapi tanggal dan jam.");
    if (addEnd <= addStart) return setAddError("Jam selesai harus setelah jam mulai.");
    if (addReason.trim().length < 10) return setAddError("Alasan minimal satu kalimat.");
    const sh = Number(addStart.slice(0, 2)), eh = Number(addEnd.slice(0, 2));
    const sm = Number(addStart.slice(3)), em = Number(addEnd.slice(3));
    const hours = Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 10) / 10;
    if (hours <= 0) return setAddError("Durasi lembur tidak valid.");
    dispatch({
      type: "SUBMIT_OVERTIME",
      request: {
        id: `OT-${String(data.overtimeRequests.length + 100).padStart(3, "0")}`,
        employeeId: me.employee.id,
        date: addDate,
        start: addStart,
        end: addEnd,
        hours,
        reason: addReason.trim(),
        status: "pending",
        submittedAt: new Date().toISOString(),
      },
    });
    setShowAdd(false);
    toastOk("Pengajuan lembur dikirim");
  }

  return (
    <>
      <PageHead
        title="Lembur"
        sub="Kelola pengajuan lembur dan pantau rekap jam lembur karyawan."
        action={
          me ? (
            <Btn icon={Plus} onClick={openAdd}>Pengajuan</Btn>
          ) : undefined
        }
      />

      <div>
          {/* Statistik ringkas */}
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <section className="border border-rule bg-card px-5 py-4">
              <p className="text-xs font-semibold tracking-widest text-ink-faint uppercase">
                Jam Lembur Approved — Bulan Ini
              </p>
              <p className="tnum mt-1 text-3xl font-bold">
                {otHours}
                <span className="ml-1.5 text-sm font-medium text-ink-faint">jam</span>
              </p>
            </section>
            <section className="border border-rule bg-card px-5 py-4">
              <p className="text-xs font-semibold tracking-widest text-ink-faint uppercase">
                Menunggu Keputusan
              </p>
              <p className="tnum mt-1 text-3xl font-bold">
                {pending.length}
                <span className="ml-1.5 text-sm font-medium text-ink-faint">pengajuan</span>
              </p>
            </section>
          </div>

          <div className="mb-3 flex gap-2"><input value={q} onChange={e=> {setQ(e.target.value); setPage(1);}} placeholder="Cari nama/alasan..." className="flex-1 border border-rule bg-card px-3 py-2 text-sm" /><span className="py-2 text-xs text-ink-faint">{filtered.length} hasil</span></div>
          {/* Tabel pengajuan */}
          <section className="border border-rule bg-card">
            <header className="flex items-baseline justify-between border-b border-rule px-5 py-3.5">
              <h2 className="font-semibold">Daftar Pengajuan</h2>
              <span className="tnum text-xs text-ink-faint">{filtered.length} total</span>
            </header>
            {data.overtimeRequests.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="Belum ada pengajuan lembur"
                body="Pengajuan lembur dari karyawan akan tercatat di sini beserta status keputusannya."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-rule bg-paper text-left text-xs tracking-wide text-ink-faint uppercase">
                      <th className="px-5 py-2.5 font-semibold">Karyawan</th>
                      <th className="px-3 py-2.5 font-semibold">Tanggal</th>
                      <th className="px-3 py-2.5 font-semibold">Jam</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Durasi</th>
                      <th className="px-3 py-2.5 font-semibold">Alasan</th>
                      <th className="px-3 py-2.5 font-semibold">Status</th>
                      <th className="px-5 py-2.5 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ledger/60">
                    {paged.map((r) => (
                      <tr key={r.id}>
                        <td className="px-5 py-3">
                          <p className="font-semibold">{nameOf(r.employeeId)}</p>
                          <p className="tnum text-xs text-ink-faint">{r.employeeId}</p>
                        </td>
                        <td className="tnum px-3 py-3">{fmtDateShortID(r.date)}</td>
                        <td className="tnum px-3 py-3 text-ink-soft">
                          {r.start}–{r.end}
                        </td>
                        <td className="tnum px-3 py-3 text-right">{r.hours} jam</td>
                        <td className="max-w-[26ch] truncate px-3 py-3 text-ink-soft" title={r.reason}>
                          {r.reason}
                        </td>
                        <td className="px-3 py-3">
                          <StatusStamp status={r.status} />
                        </td>
                        <td className="px-5 py-3">
                          {canDecideOvertime(r) ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Btn variant="official" size="sm" icon={Check} onClick={() => decide(r.id, true)}>
                                Setujui
                              </Btn>
                              <Btn variant="secondary" size="sm" icon={X} onClick={() => decide(r.id, false)}>
                                Tolak
                              </Btn>
                            </div>
                          ) : (
                            <span className="block text-right tnum text-xs text-ink-faint">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <Pager page={page} total={filtered.length} limit={LIMIT} onChange={setPage} />
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Pengajuan Lembur Baru">
        <div className="space-y-3">
          <Field label="Tanggal">
            <Input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mulai">
              <Input type="time" value={addStart} onChange={(e) => setAddStart(e.target.value)} />
            </Field>
            <Field label="Selesai">
              <Input type="time" value={addEnd} onChange={(e) => setAddEnd(e.target.value)} />
            </Field>
          </div>
          <Field label="Alasan">
            <Textarea value={addReason} onChange={(e) => setAddReason(e.target.value)} placeholder="Contoh: deploy rilis mendesak..." />
          </Field>
          {addError && (
            <p role="alert" className="text-xs font-medium text-stamp-deep">{addError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => setShowAdd(false)}>Batal</Btn>
            <Btn onClick={submitAdd}>Kirim Pengajuan</Btn>
          </div>
        </div>
      </Modal>
    </>
  );
}
