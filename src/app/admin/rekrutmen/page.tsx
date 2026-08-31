"use client";

import { useMemo, useState } from "react";
import { Plus, UsersThree, Pencil, Trash } from "@phosphor-icons/react";
import { Btn, EmptyState, Field, Input, Modal, PageHead, Pager, Select, Stamp, Textarea } from "@/components/ui";
import { useHris } from "@/lib/store";
import type { JobPosting } from "@/lib/types";

const CANDIDATE_STATUS: Record<string, { label: string; kind: "pending" | "approved" | "rejected" | "neutral" }> = {
  applied: { label: "Applied", kind: "neutral" },
  screening: { label: "Screening", kind: "pending" },
  interview: { label: "Interview", kind: "pending" },
  offer: { label: "Offer", kind: "approved" },
  hired: { label: "Hired", kind: "approved" },
  rejected: { label: "Rejected", kind: "rejected" },
};

export default function AdminRekrutmen() {
  const { state, dispatch } = useHris();
  const { data } = state;
  const [tab, setTab] = useState<"lowongan" | "pelamar" | "tambah_lowongan">("lowongan");
  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const LIMIT = 10;

  // Form Fields for Job Posting
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("DP-TEC");
  const [salaryRange, setSalaryRange] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [status, setStatus] = useState<"open" | "closed">("open");

  const postings = useMemo(() =>
    data.jobPostings.map((jp) => ({
      ...jp,
      dept: data.departments.find((d) => d.id === jp.departmentId),
      candidateCount: data.candidates.filter((c) => c.jobPostingId === jp.id).length,
    })),
    [data.jobPostings, data.departments, data.candidates],
  );

  const candidates = useMemo(() =>
    data.candidates
      .filter((c) => statusFilter === "all" || c.status === statusFilter)
      .filter((c) => {
        if (!q.trim()) return true;
        const job = data.jobPostings.find((j) => j.id === c.jobPostingId);
        return `${c.name} ${c.email} ${job?.title ?? ""}`.toLowerCase().includes(q.toLowerCase());
      })
      .map((c) => ({
        ...c,
        job: data.jobPostings.find((j) => j.id === c.jobPostingId),
      })),
    [data.candidates, data.jobPostings, statusFilter, q],
  );
  const pagedCandidates = candidates.slice((page - 1) * LIMIT, page * LIMIT);

  function resetForm() {
    setTitle(""); setDepartmentId("DP-TEC"); setSalaryRange(""); setDescription("");
    setRequirements(""); setStatus("open"); setEditId(null); setShowForm(false);
  }

  function updateCandidateStatus(id: string, status: string) {
    dispatch({ type: "UPDATE_CANDIDATE", id, status: status as never });
  }

  function startEdit(jp: JobPosting) {
    setEditId(jp.id);
    setTitle(jp.title);
    setDepartmentId(jp.departmentId);
    setSalaryRange(jp.salaryRange);
    setDescription(jp.description);
    setRequirements(jp.requirements);
    setStatus(jp.status as "open" | "closed");
    setShowForm(true);
  }

  function handleSave() {
    if (!title || !salaryRange) return;
    if (editId) {
      dispatch({
        type: "UPDATE_JOB_POSTING",
        id: editId,
        data: { title, departmentId, salaryRange, description, requirements, status },
      });
    } else {
      const newJob: JobPosting = {
        id: `JOB-${String(data.jobPostings.length + 100).padStart(3, "0")}`,
        title, departmentId, salaryRange, description, requirements, status,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "CREATE_JOB_POSTING", job: newJob });
    }
    resetForm();
  }

  function handleDelete(id: string) {
    if (confirm("Hapus lowongan ini dari sistem?")) {
      dispatch({ type: "DELETE_JOB_POSTING", id });
    }
  }

  return (
    <>
      <PageHead
        title="Rekrutmen"
        sub="Kelola lowongan pekerjaan dan tracking pelamar."
        action={
          tab === "lowongan" ? (
            <Btn variant="official" size="sm" onClick={() => { resetForm(); setShowForm(true); }}>+ Lowongan</Btn>
          ) : undefined
        }
      />

      <div className="mb-4 flex gap-2">
        <Btn variant={tab === "lowongan" ? "primary" : "secondary"} onClick={() => setTab("lowongan")}>Lowongan</Btn>
        <Btn variant={tab === "pelamar" ? "primary" : "secondary"} onClick={() => setTab("pelamar")}>Pelamar ({data.candidates.length})</Btn>
      </div>

      {tab === "lowongan" && (
        postings.length === 0 ? (
          <EmptyState icon={UsersThree} title="Belum ada lowongan" body="Buat lowongan baru untuk mulai rekrutmen." />
        ) : (
          <div className="space-y-3">
            {postings.map((jp) => (
              <section key={jp.id} className="border border-rule bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-official">{jp.title}</h3>
                    <p className="text-xs text-ink-soft">{jp.dept?.name} · {jp.salaryRange}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Stamp kind={jp.status === "open" ? "approved" : "neutral"}>{jp.status === "open" ? "Open" : "Closed"}</Stamp>
                    <button onClick={() => startEdit(jp as any)} className="btn-press p-1 text-ink-faint hover:text-official"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(jp.id)} className="btn-press p-1 text-ink-faint hover:text-stamp"><Trash size={14} /></button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-ink-soft">{jp.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-ink-faint">
                  <span>{jp.candidateCount} pelamar</span>
                  <span>{jp.requirements}</span>
                </div>
              </section>
            ))}
          </div>
        )
      )}

      {tab === "pelamar" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Input placeholder="Cari nama / email…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="w-40">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter status pelamar">
                <option value="all">Semua status</option>
                {Object.entries(CANDIDATE_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </Select>
            </div>
          </div>
          {candidates.length === 0 ? (
            <EmptyState icon={UsersThree} title="Tidak ada pelamar" body="Belum ada pelamar untuk filter ini." />
          ) : (
            <div className="overflow-x-auto border border-rule bg-card">
              <table className="w-full min-w-[650px] text-sm">
                <thead>
                  <tr className="border-b border-rule font-mono text-[10px] tracking-widest text-ink-faint uppercase">
                    <th className="px-4 py-2.5 text-left">Nama</th>
                    <th className="px-3 py-2.5 text-left">Lowongan</th>
                    <th className="px-3 py-2.5 text-left">Kontak</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ledger/50">
                  {pagedCandidates.map((c) => (
                    <tr key={c.id} className="hover:bg-black/[0.02]">
                      <td className="px-4 py-3">
                        <p className="font-medium">{c.name}</p>
                        <p className="tnum text-[10px] text-ink-faint">{c.id}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-ink-soft">{c.job?.title ?? "-"}</td>
                      <td className="px-3 py-3 text-xs text-ink-soft">{c.email}</td>
                      <td className="px-3 py-3 text-center"><Stamp kind={CANDIDATE_STATUS[c.status]?.kind ?? "neutral"}>{CANDIDATE_STATUS[c.status]?.label}</Stamp></td>
                      <td className="px-3 py-3 text-center">
                        <Select value={c.status} onChange={(e) => updateCandidateStatus(c.id, e.target.value)} aria-label="Ubah status" className="border border-rule bg-card px-2 py-1 text-xs">
                          {Object.entries(CANDIDATE_STATUS).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} total={candidates.length} limit={LIMIT} onChange={setPage} />
        </>
      )}

      {/* Add / Edit Modal */}
      <Modal open={showForm} onClose={resetForm} title={editId ? "Edit Lowongan" : "Lowongan Pekerjaan Baru"}>
        <div className="space-y-3">
          <Field label="Nama Lowongan / Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Senior Backend Engineer" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Departemen">
              <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                {data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
            <Field label="Kisaran Gaji">
              <Input value={salaryRange} onChange={(e) => setSalaryRange(e.target.value)} placeholder="Contoh: Rp 10jt - 15jt" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value as "open" | "closed")}>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </Select>
            </Field>
            <Field label="Kualifikasi Singkat">
              <Input value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder="Contoh: Min. 3 thn Laravel/NextJS" />
            </Field>
          </div>
          <Field label="Deskripsi Pekerjaan">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </Field>
          <Btn variant="official" onClick={handleSave} disabled={!title || !salaryRange} className="w-full">
            {editId ? "Simpan Perubahan" : "Publikasikan Lowongan"}
          </Btn>
        </div>
      </Modal>
    </>
  );
}
