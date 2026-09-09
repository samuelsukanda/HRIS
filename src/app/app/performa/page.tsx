"use client";
import { Star } from "@phosphor-icons/react";
import { EmptyState, Stamp } from "@/components/ui";
import { currentUser, useHris } from "@/lib/store";

export default function EmployeePerforma(){
  const {state}=useHris(); const me=currentUser(state); if(!me) return null;
  const my = state.data.performanceReviews.filter(r=> r.employeeId===me.employee.id).sort((a,b)=> b.period.localeCompare(a.period));
  return <>
    <h1 className="mb-1 text-xl font-bold tracking-tight">Performa</h1>
    <p className="mb-4 text-sm text-ink-soft">Rekap penilaian kinerja Anda.</p>
    {my.length===0 ?       <EmptyState icon={Star} title="Belum Ada Review" body="Penilaian kinerja Anda akan ditampilkan setelah proses review selesai." /> : (
      <div className="space-y-3">
        {my.map(r=> (
          <section key={r.id} className="border border-rule bg-card p-4">
            <div className="flex items-center justify-between"><p className="font-semibold">{r.period}</p><Stamp kind={r.status==="final"?"approved": r.status==="submitted" ? "pending":"neutral"}>{r.status}</Stamp></div>
            <p className="mt-1 tnum text-sm font-bold">Skor {r.score}/5</p>
            <div className="mt-3 grid gap-2 text-xs leading-relaxed">
              <div><p className="font-semibold text-ink">Kelebihan</p><p className="text-ink-soft">{r.strengths}</p></div>
              <div><p className="font-semibold text-ink">Perlu Ditingkatkan</p><p className="text-ink-soft">{r.improvements}</p></div>
              <div><p className="font-semibold text-ink">Goals</p><p className="text-ink-soft">{r.goals}</p></div>
            </div>
          </section>
        ))}
      </div>
    )}
  </>
}
