"use client";

import { useState } from "react";
import { Check, Clock, X } from "@phosphor-icons/react";
import { Btn, EmptyState, PageHead, Pager, StatusStamp } from "@/components/ui";
import { toastOk } from "@/lib/swal";
import { fmtDateShortID } from "@/lib/format";
import { currentUser, todayISO, useHris } from "@/lib/store";

export default function AdminLemburPage() {
  const { state, dispatch } = useHris();
  const { data } = state;
  const me = currentUser(state);
  const myEmpId = me?.employee.id;

  function isSpvFor(empId: string) {
    if (!myEmpId) return false;
    const emp = data.employees.find((e) => e.id === empId);
    return emp?.spvId === myEmpId;
  }

  function isManagerFor(empId: string) {
    if (!myEmpId) return false;
    const emp = data.employees.find((e) => e.id === empId);
    return emp?.managerId === myEmpId;
  }

  const monthPrefix = todayISO().slice(0, 7);
  const approvedThisMonth = data.overtimeRequests.filter(
    (r) => r.status === "approved" && r.date.startsWith(monthPrefix),
  );
  const otHours = approvedThisMonth.reduce((s, r) => s + r.hours, 0);
  const pending = data.overtimeRequests.filter((r) => r.status === "pending" || r.status === "spv_approved");

  const nameOf = (id: string) => data.employees.find((e) => e.id === id)?.name ?? id;
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 10;
  const filtered = data.overtimeRequests.filter(r=> !q.trim() || `${nameOf(r.employeeId)} ${r.reason}`.toLowerCase().includes(q.toLowerCase()));
  const paged = filtered.slice((page - 1) * LIMIT, page * LIMIT);

  function decide(id: string, approve: boolean) {
    if (!me) return;
    dispatch({ type: "DECIDE_OVERTIME", id, approve, byName: me.employee.name });
    toastOk(approve ? "Lembur disetujui" : "Lembur ditolak");
  }

  return (
    <>
      <PageHead
        title="Lembur"
        sub="Kelola pengajuan lembur dan pantau rekap jam lembur karyawan."
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
                          {(r.status === "pending" && isSpvFor(r.employeeId)) ||
                          (r.status === "pending" && isManagerFor(r.employeeId)) ||
                          (r.status === "spv_approved" && isManagerFor(r.employeeId)) ? (
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
    </>
  );
}
