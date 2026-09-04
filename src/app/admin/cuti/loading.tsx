import { PageHeadSkeleton, Sk } from "@/components/skeletons";

export default function CutiLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat data cuti">
      <PageHeadSkeleton withAction={false} />
      <Sk className="mb-4 h-10 w-full !rounded-[4px]" />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-0 border border-rule bg-card">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 border-b border-ledger/60 px-5 py-3.5 last:border-b-0">
              <Sk className="h-9 w-9 shrink-0 !rounded-full" />
              <div className="flex-1 space-y-2">
                <Sk className="h-4 w-1/3" />
                <Sk className="h-3 w-2/3 !bg-ledger/40" />
              </div>
              <Sk className="h-5 w-16 shrink-0 !rounded-full" />
            </div>
          ))}
        </div>
        <div className="space-y-3 border border-rule bg-card p-5">
          <Sk className="h-5 w-32" />
          {[0, 1, 2].map((i) => (
            <Sk key={i} className="h-4 w-full !bg-ledger/40" />
          ))}
          <Sk className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}
