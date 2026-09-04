import { PageHeadSkeleton, Sk } from "@/components/skeletons";

export default function AuditLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat audit log">
      <PageHeadSkeleton withAction={false} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Sk className="h-9 min-w-52 flex-1 !rounded-[4px]" />
        <Sk className="h-9 w-36 !rounded-[4px]" />
        <Sk className="h-9 w-36 !rounded-[4px]" />
        <Sk className="h-9 w-28 !rounded-[4px]" />
      </div>
      <div className="space-y-0 border border-rule bg-card px-5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="grid grid-cols-[110px_160px_190px_160px_1fr] gap-x-4 border-b border-ledger/40 py-3 last:border-b-0">
            <Sk className="h-3" />
            <Sk className="h-3" />
            <Sk className="h-3" />
            <Sk className="h-3" />
            <Sk className="h-3" />
          </div>
        ))}
      </div>
    </div>
  );
}
