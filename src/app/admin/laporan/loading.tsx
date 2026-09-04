import { PageHeadSkeleton, Sk } from "@/components/skeletons";

export default function LaporanLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat laporan">
      <PageHeadSkeleton withAction={false} />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Sk className="h-9 w-48 !rounded-[4px]" />
        <Sk className="h-9 w-24 !rounded-[4px]" />
        <Sk className="h-9 w-24 !rounded-[4px]" />
        <Sk className="h-9 w-24 !rounded-[4px]" />
      </div>
      <div className="border border-rule bg-card">
        <div className="flex items-center justify-between border-b border-rule px-5 py-3.5">
          <Sk className="h-5 w-56" />
          <Sk className="h-3 w-20 !bg-ledger/40" />
        </div>
        <div className="space-y-2 px-5 py-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Sk className="h-4 w-24 shrink-0" />
              <Sk className="h-1.5 flex-1" />
              <Sk className="h-4 w-10 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
