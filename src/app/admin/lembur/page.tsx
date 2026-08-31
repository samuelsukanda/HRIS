"use client";

import { useState } from "react";
import { Check, Clock, X } from "@phosphor-icons/react";
import { Btn, EmptyState, PageHead, Pager, StatusStamp } from "@/components/ui";
import { overtimeAmount } from "@/lib/engine";
import { fmtDateShortID, fmtRupiah } from "@/lib/format";
import { currentUser, todayISO, useHris } from "@/lib/store";

const RATE_CONTOH = 25_000;

export default function AdminLemburPage() {
  const { state, dispatch } = useHris();
  const { data } = state;
  const me = currentUser(state);
  const canDecide = !!me && me.user.role !== "employee";

  const monthPrefix = todayISO().slice(0, 7);
  const approvedThisMonth = data.overtimeRequests.filter(
    (r) => r.status === "approved" && r.date.startsWith(monthPrefix),
  );
  const otHours = approvedThisMonth.reduce((s, r) => s + r.hours, 0);
  const pending = data.overtimeRequests.filter((r) => r.status === "pending");
  const contoh = approvedThisMonth.slice(0, 4);

  const nameOf = (id: string) => data.employees.find((e) => e.id === id)?.name ?? id;
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const LIMIT = 10;
  const filtered = data.overtimeRequests.filter(r=> !q.trim() || `${nameOf(r.employeeId)} ${r.reason}`.toLowerCase().includes(q.toLowerCase()));
  const paged = filtered.slice((page - 1) * LIMIT, page * LIMIT);

  function decide(id: string, approve: boolean) {
    if (!canDecide || !me) return;
    dispatch({ type: "DECIDE_OVERTIME", id, approve, byName: me.employee.name });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function bulkDecide(approve: boolean) {
    if (!canDecide || !me || selected.length === 0) return;
    dispatch({ type: "BULK_DECIDE_OVERTIME", ids: selected, approve, byName: me.employee.name });
    setSelected([]);
  }

  return (
    <>
      <PageHead
        title="Lembur"
        sub="Pengajuan lembur karyawan menunggu keputusan HR; yang disetujui masuk rekap jam bulan berjalan dan menjadi dasar kompensasi."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
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
              <div className="flex items-center gap-3">
                {canDecide && selected.length > 0 && (
                  <div className="flex gap-2">
                    <Btn variant="official" icon={Check} onClick={() => bulkDecide(true)}>
                      Setujui {selected.length}
                    </Btn>
                    <Btn variant="danger" icon={X} onClick={() => bulkDecide(false)}>
                      Tolak {selected.length}
                    </Btn>
                  </div>
                )}
                <span className="tnum text-xs text-ink-faint">{filtered.length} total</span>
              </div>
            </header>
            {data.overtimeRequests.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="Belum ada pengajuan lembur"
                body="Pengajuan lembur dari karyawan akan tercatat di sini beserta status keputusannya."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-rule bg-paper text-left text-xs tracking-wide text-ink-faint uppercase">
                      {canDecide && <th className="w-10 px-2 py-2.5"><span className="sr-only">Pilih</span></th>}
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
                        {canDecide && (
                          <td className="px-2 py-3">
                            {r.status === "pending" && (
                              <input
                                type="checkbox"
                                checked={selected.includes(r.id)}
                                onChange={() => toggleSelect(r.id)}
                                className="h-4 w-4 accent-official"
                              />
                            )}
                          </td>
                        )}
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
                          {r.status === "pending" && canDecide ? (
                            <div className="flex justify-end gap-2">
                              <Btn variant="official" icon={Check} onClick={() => decide(r.id, true)}>
                                Setujui
                              </Btn>
                              <Btn variant="danger" icon={X} onClick={() => decide(r.id, false)}>
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

        {/* Kartu samping */}
        <aside>
          <section className="border border-rule bg-card">
            <header className="border-b border-rule px-5 py-3.5">
              <h2 className="font-semibold">Estimasi Kompensasi</h2>
            </header>
            <div className="space-y-4 px-5 py-4 text-sm">
              <p className="text-ink-soft">
                Lembur disetujui dikompensasi proporsional: jumlah jam × tarif per jam.
              </p>
              <div className="border border-dashed border-rule bg-paper px-3 py-2.5">
                <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">Tarif contoh</p>
                <p className="tnum mt-0.5 text-lg font-bold">
                  {fmtRupiah(RATE_CONTOH)}
                  <span className="text-sm font-medium text-ink-faint">/jam</span>
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-ink-faint uppercase">
                  Contoh perhitungan — approved bulan ini
                </p>
                {contoh.length === 0 ? (
                  <p className="py-2 text-ink-faint">Belum ada lembur approved bulan ini.</p>
                ) : (
                  <ul className="divide-y divide-ledger/60">
                    {contoh.map((r) => (
                      <li key={r.id} className="flex items-baseline justify-between gap-3 py-2">
                        <span className="min-w-0 truncate text-ink-soft">
                          {fmtDateShortID(r.date)} · <span className="tnum">{r.hours} jam</span>
                        </span>
                        <span className="tnum shrink-0 font-semibold">
                          {fmtRupiah(overtimeAmount(r.hours, RATE_CONTOH))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="text-xs text-ink-faint">
                Tarif di atas adalah catatan kebijakan; tarif resmi mengikuti upah per jam masing-masing karyawan.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
