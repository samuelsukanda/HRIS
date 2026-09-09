"use client";

import { useMemo, useState } from "react";
import { Ticket, X } from "@phosphor-icons/react";
import { Btn, EmptyState, PageHead, Stamp } from "@/components/ui";
import { toastOk } from "@/lib/swal";
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
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploadErr, setUploadErr] = useState<string | null>(null);
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
        ...(attachmentUrl ? { attachmentUrl } : {}),
      },
    });
    setAmount("");
    setDescription("");
    setAttachmentUrl("");
    setFileName("");
    setShowForm(false);
    toastOk("Pengajuan reimbursement dikirim");
  }

  return (
    <>
      <PageHead
        title="Reimbursement"
        sub="Ajukan klaim penggantian biaya dan pantau proses persetujuannya."
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
              <p className="mb-1 text-xs text-ink-faint">JPG/PNG/PDF max 2MB</p>
              <label className="btn-press flex min-h-9 cursor-pointer items-center gap-3 rounded-[4px] border border-dashed border-rule bg-paper px-3 py-2 text-sm hover:border-ink-faint">
                <span className="shrink-0 rounded-[4px] border border-rule bg-card px-3 py-1 text-xs font-semibold">Pilih File</span>
                <span className="min-w-0 flex-1 truncate text-xs text-ink-faint">
                  {fileName || "Belum ada file dipilih"}
                </span>
                {attachmentUrl && (
                  <button
                    type="button"
                    aria-label="Hapus file lampiran"
                    onClick={(e) => { e.preventDefault(); setAttachmentUrl(""); setFileName(""); }}
                    className="btn-press shrink-0 cursor-pointer rounded-full p-1 text-ink-faint hover:bg-black/5 hover:text-stamp"
                  >
                    <X size={14} weight="bold" />
                  </button>
                )}
                <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="sr-only" onChange={async e=> {
                const f=e.target.files?.[0];
                if(!f) return;
                if(f.size>2*1024*1024){ setUploadErr("File max 2MB"); return; }
                setUploadErr(null);
                setFileName(f.name);
                const fd=new FormData(); fd.append("file", f);
                try {
                  const r=await fetch("/api/uploads",{method:"POST",body:fd});
                  const j=await r.json() as {ok:boolean;url?:string;error?:string};
                  if(j.ok && j.url){ setAttachmentUrl(j.url); }
                  else setUploadErr(j.error ?? "Upload gagal.");
                } catch { setUploadErr("Upload gagal. Coba lagi."); }
                e.target.value="";
              }} />
              </label>
              {uploadErr && <p role="alert" className="mt-1 text-xs text-stamp-deep">{uploadErr}</p>}
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
              {r.attachmentUrl && (
                <p className="mt-1 text-xs"><a href={r.attachmentUrl} target="_blank" rel="noreferrer" className="text-official underline">Lihat lampiran</a></p>
              )}
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
