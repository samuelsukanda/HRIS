"use client";

import { useMemo, useState } from "react";
import { CheckCircle, MagnifyingGlass, XCircle } from "@phosphor-icons/react";
import { Btn, EmptyState, Input, PageHead, Pager, Select, Stamp } from "@/components/ui";
import { toastOk } from "@/lib/swal";
import { isHr } from "@/lib/roles";
import { currentUser, useHris } from "@/lib/store";

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu HR",
  spv_approved: "Menunggu HR",
  approved: "Disetujui",
  rejected: "Ditolak",
};
const STATUS_KIND: Record<string, "pending" | "approved" | "rejected"> = {
  pending: "pending",
  spv_approved: "pending",
  approved: "approved",
  rejected: "rejected",
};

export default function AdminReimbursements() {
  const { state, dispatch } = useHris();
  const { data } = state;
  const me = currentUser(state);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 10;
  const isApprover = isHr(me?.user.role ?? "");

  const rows = useMemo(() => {
    return data.reimbursements
      .filter((r) => filter === "all" || r.status === filter)
      .filter((r) => {
        if (!q.trim()) return true;
        const emp = data.employees.find((e) => e.id === r.employeeId);
        return `${emp?.name ?? ""} ${r.category} ${r.description}`.toLowerCase().includes(q.toLowerCase());
      })
      .map((r) => ({
        ...r,
        emp: data.employees.find((e) => e.id === r.employeeId),
      }));
  }, [data.reimbursements, data.employees, filter, q]);
  const paged = rows.slice((page - 1) * LIMIT, page * LIMIT);

  function decide(id: string, approve: boolean) {
    void dispatch({ type: "DECIDE_REIMBURSEMENT", id, level: "hr", approve, byName: me?.employee.name ?? "-" }).then((ok) => {
      if (ok) toastOk(approve ? "Reimbursement disetujui" : "Reimbursement ditolak");
    });
  }

  return (
    <>
      <PageHead title="Reimbursement" sub="Kelola pengajuan dan proses persetujuan biaya karyawan." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <MagnifyingGlass size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
          <Input placeholder="Cari nama / kategori…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </div>
        <div className="w-40">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter status">
            <option value="all">Semua status</option>
            <option value="pending">Menunggu HR</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </Select>
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={CheckCircle} title="Tidak ada reimbursement" body="Belum ada pengajuan reimbursement untuk periode ini." />
      ) : (
        <>
          <div className="overflow-x-auto border border-rule bg-card">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-rule font-mono text-[10px] tracking-widest text-ink-faint uppercase">
                <th className="px-4 py-2.5 text-left">Karyawan</th>
                <th className="px-3 py-2.5 text-left">Kategori</th>
                <th className="px-3 py-2.5 text-right">Jumlah</th>
                <th className="px-3 py-2.5 text-left">Keterangan</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-3 py-2.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ledger/50">
              {paged.map((r) => {
                const canApprove = (r.status === "pending" || r.status === "spv_approved") && isApprover;
                return (
                  <tr key={r.id} className="hover:bg-black/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.emp?.name ?? r.employeeId}</p>
                      <p className="tnum text-[10px] text-ink-faint">{r.id}</p>
                    </td>
                    <td className="px-3 py-3 capitalize">{r.category}</td>
                    <td className="tnum px-3 py-3 text-right font-mono">Rp {r.amount.toLocaleString("id-ID")}</td>
                    <td className="max-w-[200px] truncate px-3 py-3 text-ink-soft">{r.description}{r.attachmentUrl && <> · <a href={r.attachmentUrl} target="_blank" rel="noreferrer" className="text-official underline">lampiran</a></>}</td>
                    <td className="px-3 py-3 text-center"><Stamp kind={STATUS_KIND[r.status] ?? "pending"}>{STATUS_LABEL[r.status]}</Stamp></td>
                    <td className="px-3 py-3 text-center">
                      {canApprove ? (
                        <span className="inline-flex gap-1">
                          <Btn variant="official" size="sm" icon={CheckCircle} onClick={() => decide(r.id, true)}>Setujui</Btn>
                          <Btn variant="danger" size="sm" icon={XCircle} aria-label="Tolak" onClick={() => decide(r.id, false)} />
                        </span>
                      ) : (
                        <span className="text-xs text-ink-faint">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
      <Pager page={page} total={rows.length} limit={LIMIT} onChange={setPage} />
    </>
  );
}
