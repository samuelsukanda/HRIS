"use client";

import { useMemo, useState } from "react";
import { NotePencil, Star } from "@phosphor-icons/react";
import { Btn, EmptyState, Input, Modal, PageHead, Pager, Textarea } from "@/components/ui";
import { currentUser, useHris } from "@/lib/store";
import { toastOk } from "@/lib/swal";

export default function AdminPerforma() {
  const { state, dispatch } = useHris();
  const { data } = state;
  const me = currentUser(state);
  const [target, setTarget] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [score, setScore] = useState(3);
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [goals, setGoals] = useState("");
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
  });
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  const reviews = useMemo(() =>
    data.performanceReviews
      .filter((r) => {
        if (!q.trim()) return true;
        const emp = data.employees.find((e) => e.id === r.employeeId);
        return `${emp?.name ?? ""} ${r.period} ${r.strengths}`.toLowerCase().includes(q.toLowerCase());
      })
      .map((r) => ({
        ...r,
        emp: data.employees.find((e) => e.id === r.employeeId),
        reviewer: data.employees.find((e) => e.id === r.reviewerId),
      })),
    [data.performanceReviews, data.employees, q],
  );
  const pagedReviews = reviews.slice((page - 1) * LIMIT, page * LIMIT);

  function openForm() {
    setTarget(null);
    setStrengths("");
    setImprovements("");
    setGoals("");
    setShowForm(true);
  }

  function submitReview() {
    if (!target || !me) return;
    dispatch({
      type: "SUBMIT_REVIEW",
      review: { id: `PRF-${String(data.performanceReviews.length + 1).padStart(3, "0")}`, employeeId: target, reviewerId: me.employee.id, period, score, strengths, improvements, goals },
    });
    setTarget(null);
    setStrengths("");
    setImprovements("");
    setGoals("");
    setShowForm(false);
    toastOk("Penilaian dikirim");
  }

  return (
    <>
      <PageHead
        title="Performa"
        sub="Penilaian kinerja karyawan per periode."
        action={<Btn icon={NotePencil} onClick={openForm}>Buat Penilaian</Btn>}
      />
      <div className="mb-4 max-w-md">
        <Input placeholder="Cari nama / periode…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {reviews.length === 0 ? (
        <EmptyState icon={Star} title="Belum ada penilaian" body="Buat penilaian pertama untuk karyawan." />
      ) : (
        <div className="space-y-3">
          {pagedReviews.map((r) => (
            <section key={r.id} className="border border-rule bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{r.emp?.name ?? r.employeeId}</h3>
                  <p className="text-xs text-ink-soft">Reviewer: {r.reviewer?.name ?? "-"} · {r.period}</p>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} size={16} weight={s <= r.score ? "fill" : "regular"} className={s <= r.score ? "text-yellow-500" : "text-ink-faint"} />
                  ))}
                </div>
              </div>
              {r.strengths && <p className="mt-2 text-sm"><span className="font-semibold">Kekuatan:</span> {r.strengths}</p>}
              {r.improvements && <p className="mt-1 text-sm"><span className="font-semibold">Improvement:</span> {r.improvements}</p>}
              {r.goals && <p className="mt-1 text-sm"><span className="font-semibold">Goals:</span> {r.goals}</p>}
              <div className="mt-2 flex items-center gap-2">
                <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${r.status === "final" ? "bg-official/10 text-official" : r.status === "submitted" ? "bg-yellow-100 text-yellow-700" : "bg-ink/5 text-ink-faint"}`}>{r.status}</span>
                {r.status !== "final" && me?.user.role === "hr_manager" && (
                  <Btn variant="official" size="sm" onClick={() => dispatch({ type: "FINALIZE_REVIEW", id: r.id })}>Finalize</Btn>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <Pager page={page} total={reviews.length} limit={LIMIT} onChange={setPage} />

      {showForm && (
        <Modal open={showForm} onClose={() => setShowForm(false)} title="Penilaian Baru">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block font-mono text-[11px] tracking-widest text-ink-faint uppercase">Karyawan</label>
              <select value={target ?? ""} onChange={(e) => setTarget(e.target.value || null)} className="w-full border border-rule bg-card px-3 py-2 text-sm">
                <option value="">Pilih karyawan</option>
                {data.employees.filter((e) => e.status === "active").map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] tracking-widest text-ink-faint uppercase">Periode</label>
              <Input value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] tracking-widest text-ink-faint uppercase">Skor (1-5)</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => setScore(s)} className="cursor-pointer"><Star size={24} weight={s <= score ? "fill" : "regular"} className={s <= score ? "text-yellow-500" : "text-ink-faint"} /></button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] tracking-widest text-ink-faint uppercase">Kekuatan</label>
              <Textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={2} />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] tracking-widest text-ink-faint uppercase">Area Improvement</label>
              <Textarea value={improvements} onChange={(e) => setImprovements(e.target.value)} rows={2} />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] tracking-widest text-ink-faint uppercase">Goals</label>
              <Textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={2} />
            </div>
            <Btn variant="official" onClick={submitReview} disabled={!target || target === "new"}>Submit Penilaian</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}
