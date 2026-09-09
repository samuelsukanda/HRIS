"use client";

import { useMemo, useState } from "react";
import { CheckCircle, MagnifyingGlass, XCircle } from "@phosphor-icons/react";
import { Btn, EmptyState, Input, PageHead, Pager, Select, Stamp } from "@/components/ui";
import { toastOk } from "@/lib/swal";
import { currentUser, useHris } from "@/lib/store";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  manager_approved: "Manager Approved",
  approved: "Approved",
  rejected: "Rejected",
};
const STATUS_KIND: Record<string, "pending" | "approved" | "rejected"> = {
  pending: "pending",
  manager_approved: "pending",
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
  const [selected, setSelected] = useState<string[]>([]);
  const LIMIT = 10;
  const isHR = me?.user.role === "hr_manager" || me?.user.role === "hr_admin" || me?.user.role === "super_admin";
  const isManager = me?.user.role === "manager";

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

  function decide(id: string, level: "manager" | "hr", approve: boolean) {
    dispatch({ type: "DECIDE_REIMBURSEMENT", id, level, approve, byName: me?.employee.name ?? "-" });
    toastOk(approve ? "Reimbursement disetujui" : "Reimbursement ditolak");
  }

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function bulkDecide(level: "manager" | "hr", approve: boolean) {
    if (selected.length === 0) return;
    dispatch({ type: "BULK_DECIDE_REIMBURSEMENT", ids: selected, approve, level });
    toastOk(approve ? `${selected.length} reimbursement disetujui` : `${selected.length} reimbursement ditolak`);
    setSelected([]);
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
            <option value="pending">Pending</option>
            <option value="manager_approved">Manager Approved</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </Select>
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={CheckCircle} title="Tidak ada reimbursement" body="Belum ada pengajuan reimbursement untuk periode ini." />
      ) : (
        <>
          {(isHR || isManager) && selected.length > 0 && (
            <div className="mb-3 flex gap-2">
              {isManager && <Btn variant="official" size="sm" onClick={() => bulkDecide("manager", true)}>Setujui Manager ({selected.length})</Btn>}
              {isHR && <Btn variant="official" size="sm" onClick={() => bulkDecide("hr", true)}>Setujui HR ({selected.length})</Btn>}
              <Btn variant="danger" size="sm" onClick={() => bulkDecide(isHR ? "hr" : "manager", false)}>Tolak ({selected.length})</Btn>
            </div>
          )}
          <div className="overflow-x-auto border border-rule bg-card">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-rule font-mono text-[10px] tracking-widest text-ink-faint uppercase">
                {(isHR || isManager) && <th className="w-10 px-2 py-2.5"><span className="sr-only">Pilih</span></th>}
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
                const canApproveManager = r.status === "pending" && me?.user.role !== "employee";
                const canApproveHR = r.status === "manager_approved" && me?.user.role === "hr_manager";
                return (
                  <tr key={r.id} className="hover:bg-black/[0.02]">
                    {(isHR || isManager) && (
                      <td className="px-2 py-3">
                        {(canApproveManager || canApproveHR) && (
                          <input
                            type="checkbox"
                            checked={selected.includes(r.id)}
                            onChange={() => toggleSelect(r.id)}
                            className="h-4 w-4 accent-official"
                          />
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.emp?.name ?? r.employeeId}</p>
                      <p className="tnum text-[10px] text-ink-faint">{r.id}</p>
                    </td>
                    <td className="px-3 py-3 capitalize">{r.category}</td>
                    <td className="tnum px-3 py-3 text-right font-mono">Rp {r.amount.toLocaleString("id-ID")}</td>
                    <td className="max-w-[200px] truncate px-3 py-3 text-ink-soft">{r.description}{r.attachmentUrl && <> · <a href={r.attachmentUrl} target="_blank" rel="noreferrer" className="text-official underline">lampiran</a></>}</td>
                    <td className="px-3 py-3 text-center"><Stamp kind={STATUS_KIND[r.status] ?? "pending"}>{STATUS_LABEL[r.status]}</Stamp></td>
                    <td className="px-3 py-3 text-center">
                      {canApproveManager && (
                        <span className="inline-flex gap-1">
                          <Btn variant="official" size="sm" icon={CheckCircle} onClick={() => decide(r.id, "manager", true)}>Mgr</Btn>
                          <Btn variant="danger" size="sm" icon={XCircle} aria-label="Tolak" onClick={() => decide(r.id, "manager", false)} />
                        </span>
                      )}
                      {canApproveHR && (
                        <span className="inline-flex gap-1">
                          <Btn variant="official" size="sm" icon={CheckCircle} onClick={() => decide(r.id, "hr", true)}>HR</Btn>
                          <Btn variant="danger" size="sm" icon={XCircle} aria-label="Tolak" onClick={() => decide(r.id, "hr", false)} />
                        </span>
                      )}
                      {!canApproveManager && !canApproveHR && (
                        <span className="text-xs text-ink-faint">{r.approvals.length}/{r.status === "approved" ? 2 : r.approvals.length}</span>
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
