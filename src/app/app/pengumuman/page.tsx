"use client";

import { Megaphone } from "@phosphor-icons/react";
import { EmptyState, PageHead } from "@/components/ui";
import { useHris } from "@/lib/store";

export default function EmployeePengumumanPage() {
  const { state } = useHris();
  const { data } = state;

  return (
    <>
      <PageHead title="Pengumuman" sub="Informasi dan pengumuman terbaru dari perusahaan." />
      {data.announcements.length === 0 ? (
        <EmptyState icon={Megaphone} title="Belum ada pengumuman" body="Pengumuman akan muncul di sini." />
      ) : (
        <ul className="space-y-3">
          {data.announcements.map((a) => (
            <li key={a.id} className="border border-rule bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{a.title}</h3>
                <span className="shrink-0 rounded bg-ink/5 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-soft">{a.category}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{a.body}</p>
              <p className="tnum mt-2 text-[10px] text-ink-faint">{a.date}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
