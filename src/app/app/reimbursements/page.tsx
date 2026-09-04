"use client";

import { useMemo, useState } from "react";
import { Ticket } from "@phosphor-icons/react";
import { Btn, EmptyState, PageHead, Stamp } from "@/components/ui";
import { currentUser, useHris } from "@/lib/store";

const STATUS_KIND: Record<string, "pending" | "approved" | "rejected" | "neutral"> = {
  pending: "pending",
  manager_approved: "pending",
  approved: "approved",
  rejected: "rejected",
};

export default function MyReimbursements() {
  const { state, dispatch } = useHris();
  const { data } = state;
  const me = currentUser(state);
  const [category, setCategory] = useState<string>("transport");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [showForm, setShowForm] = useState(false);

  const myReimb = useMemo(() =>
    me ? data.reimbursements.filter((r) => r.employeeId === me.employee.id) : [],
    [data.reimbursements, me],
  );

  function submit() {
    if (!me || !amount || !description.trim()) return;
    dispatch({
      type: "SUBMIT_REIMBURSEMENT",
      request: {
        id: `RBM-${String(data.reimbursements.length + 1).padStart(3, "0")}`,
        employeeId: me.employee.id,
        category: category as never,
        amount: Number(amount),
        description: description.trim(),
        status: "pending",
        submittedAt: new Date().toISOString(),
        approvals: [],
      },
    });
    setAmount("");
    setDescription("");
    setShowForm(false);
  }

  return (
    <>
      <PageHead
        title="Reimbursement"
        sub="Ajukan penggantian biaya dan lihat status."
        action={!showForm ? <Btn variant="official" size="sm" onClick={() => setShowForm(true)}>+ Ajukan</Btn> : undefined}
      />

      {showForm && (
        <section className="mb-6 border border-rule bg-card p-4">
          <h2 className="mb-3 font-semibold">Form Pengajuan</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block font-mono text-[11px] tracking-widest text-ink-faint uppercase">Kategori</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-rule bg-card px-3 py-2 text-sm">
                <option value="transport">Transport</option>
                <option value="meal">Meal</option>
                <option value="accommodation">Accommodation</option>
                <option value="equipment">Equipment</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] tracking-widest text-ink-faint uppercase">Jumlah (Rp)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border border-rule bg-card px-3 py-2 text-sm" placeholder="0" />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] tracking-widest text-ink-faint uppercase">Keterangan</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full border border-rule bg-card px-3 py-2 text-sm" placeholder="Jelaskan pengeluaran..." />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] tracking-widest text-ink-faint uppercase">Lampiran (opsional)</label>
              <input type="file" accept=".jpg,.png,.pdf" onChange={e=> { const f=e.target.files?.[0]; if(!f) return; if(f.size>2*1024*1024) return; setDescription(d=> d ? `${d} [Lampiran: ${f.name}]` : `[Lampiran: ${f.name}]`); }} className="w-full border border-rule bg-card px-3 py-2 text-xs" />
            </div>
            <div className="flex gap-2">
              <Btn variant="official" size="md" onClick={submit} disabled={!amount || !description.trim()}>Submit</Btn>
              <Btn variant="secondary" size="md" onClick={() => setShowForm(false)}>Batal</Btn>
            </div>
          </div>
        </section>
      )}

      {myReimb.length === 0 ? (
        <EmptyState icon={Ticket} title="Belum ada reimbursement" body="Ajukan reimbursement untuk penggantian biaya yang telah Anda keluarkan." />
      ) : (
        <ul className="space-y-2">
          {myReimb.map((r) => (
            <li key={r.id} className="border border-rule bg-card p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold capitalize">{r.category}</span>
                <Stamp kind={STATUS_KIND[r.status]}>{r.status.replace("_", " ")}</Stamp>
              </div>
              <p className="tnum mt-1 font-mono text-sm text-official">Rp {r.amount.toLocaleString("id-ID")}</p>
              <p className="mt-0.5 text-xs text-ink-soft">{r.description}</p>
              {r.approvals.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.approvals.map((a, i) => (
                    <span key={i} className={`inline-block rounded px-1.5 py-0.5 text-[10px] ${a.approved ? "bg-official/10 text-official" : "bg-stamp/10 text-stamp"}`}>
                      {a.level}: {a.approved ? "✓" : "✗"}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
