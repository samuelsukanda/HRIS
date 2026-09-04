import { PageHeadSkeleton, Sk } from "@/components/skeletons";

export default function LokasiLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat lokasi kerja">
      <PageHeadSkeleton />
      <div className="grid gap-5 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="border border-rule bg-card">
            <div className="flex items-start justify-between gap-3 border-b border-rule px-5 py-4">
              <div className="flex-1 space-y-2">
                <Sk className="h-5 w-2/3" />
                <Sk className="h-3 w-1/3 !bg-ledger/40" />
              </div>
              <Sk className="h-5 w-16 !rounded-full" />
            </div>
            <div className="grid gap-4 px-5 py-4 sm:grid-cols-[1fr_150px]">
              <div className="space-y-2">
                <Sk className="h-4 w-full" />
                <Sk className="h-4 w-full" />
                <Sk className="h-6 w-full" />
              </div>
              <Sk className="h-[150px] w-[150px] !rounded-none" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 space-y-3 border border-rule bg-card p-5">
        <Sk className="h-5 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Sk className="h-8" />
          <Sk className="h-8" />
          <Sk className="h-8" />
        </div>
      </div>
    </div>
  );
}
