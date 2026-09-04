export default function RootLoading() {
  return (
    <div className="grid min-h-[100dvh] bg-paper lg:grid-cols-[1.15fr_0.85fr]" aria-busy="true" aria-label="Memuat halaman">
      <div className="hidden flex-col justify-between border-r border-rule bg-card px-12 py-12 lg:flex">
        <div className="h-4 w-24 animate-pulse rounded bg-ledger/60" />
        <div className="space-y-3">
          <div className="h-10 w-3/4 animate-pulse rounded bg-ledger/60" />
          <div className="h-10 w-2/3 animate-pulse rounded bg-ledger/40" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-ledger/40" />
        </div>
        <div className="grid max-w-md grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded border-t-2 border-ledger/60 pt-2" />
          ))}
        </div>
      </div>
      <div className="flex flex-col justify-center px-6 py-12 sm:px-14">
        <div className="mx-auto w-full max-w-md space-y-3">
          <div className="h-6 w-24 animate-pulse rounded bg-ledger/60" />
          <div className="h-4 w-48 animate-pulse rounded bg-ledger/40" />
          <div className="h-11 animate-pulse rounded-[4px] border border-rule bg-card" />
          <div className="h-11 animate-pulse rounded-[4px] border border-rule bg-card" />
          <div className="h-11 animate-pulse rounded-[4px] bg-ledger/50" />
        </div>
      </div>
    </div>
  );
}
