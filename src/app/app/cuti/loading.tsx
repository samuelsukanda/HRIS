import { FormSkeleton, ListSkeleton, Sk } from "@/components/skeletons";

export default function CutiLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat cuti">
      <Sk className="h-7 w-40" />
      <Sk className="mt-1 mb-4 h-4 w-72 !bg-ledger/40" />
      <div className="mb-6 border border-rule bg-card">
        <div className="border-b border-rule px-4 py-2.5">
          <Sk className="h-4 w-28" />
        </div>
        <div className="space-y-0 px-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between border-b border-ledger/50 py-2.5 last:border-b-0">
              <Sk className="h-4 w-32" />
              <Sk className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
      <div className="mb-6">
        <FormSkeleton />
      </div>
      <Sk className="mb-2 h-4 w-20" />
      <ListSkeleton rows={3} />
    </div>
  );
}
