import { PageHeadSkeleton, Sk } from "@/components/skeletons";

export default function JadwalLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat jadwal">
      <PageHeadSkeleton withAction={false} />
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sk className="h-9 w-9 !rounded-[4px]" />
          <Sk className="h-5 w-52" />
          <Sk className="h-9 w-9 !rounded-[4px]" />
        </div>
        <Sk className="h-9 w-24 !rounded-[4px]" />
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 border border-rule bg-card p-4">
            <Sk className="h-4 w-2/3" />
            <Sk className="h-7 w-1/2" />
            <Sk className="h-3 w-1/3 !bg-ledger/40" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden border border-rule bg-card">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-1 border-b border-ledger/40 px-4 py-2">
            <Sk className="h-6 w-32 shrink-0" />
            {Array.from({ length: 7 }).map((_, j) => (
              <Sk key={j} className="h-6 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
