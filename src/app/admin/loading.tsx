import { PageHeadSkeleton, TableSkeleton } from "@/components/skeletons";

export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat dashboard">
      <PageHeadSkeleton withAction={false} />
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <div className="space-y-2 rounded-[1.5rem] border border-rule bg-card p-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 py-1.5">
              <div className="h-4 w-20 animate-pulse rounded bg-ledger/50" />
              <div className="h-4 w-8 animate-pulse rounded bg-ledger/60" />
              <div className="h-1.5 flex-1 animate-pulse rounded bg-ledger/40" />
            </div>
          ))}
        </div>
        <div className="space-y-3 rounded-[1.5rem] border border-rule bg-card p-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="h-4 w-1/2 animate-pulse rounded bg-ledger/50" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-ledger/40" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6">
        <TableSkeleton rows={4} cols={4} />
      </div>
    </div>
  );
}
