// Blok kerangka loading — tiruan bentuk layout tiap menu (animate-pulse, tanpa teks berteriak).
export function Sk({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded bg-ledger/50 ${className}`} />;
}

export function PageHeadSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2">
        <Sk className="h-8 w-48" />
        <Sk className="h-4 w-80 max-w-full !bg-ledger/40" />
      </div>
      {withAction && <Sk className="h-9 w-28 !rounded-[4px]" />}
    </div>
  );
}

export function FilterRowSkeleton() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Sk className="h-9 min-w-52 flex-1 !rounded-[4px]" />
      <Sk className="h-9 w-44 !rounded-[4px]" />
      <Sk className="h-9 w-44 !rounded-[4px]" />
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden border border-rule bg-card">
      <div className="grid gap-4 border-b border-rule bg-paper px-5 py-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Sk key={i} className="h-3 !bg-ledger/40" />
        ))}
      </div>
      <div className="divide-y divide-ledger/40 px-5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid items-center gap-4 py-3.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
            {Array.from({ length: cols }).map((_, j) => (
              <Sk key={j} className={`h-4 ${j === 0 ? "w-3/4" : ""}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2 border border-rule bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <Sk className="h-5 w-1/3" />
            <Sk className="h-5 w-16 !rounded-full" />
          </div>
          <Sk className="h-3 w-1/4 !bg-ledger/40" />
          <Sk className="h-3 w-full !bg-ledger/40" />
          <Sk className="h-3 w-2/3 !bg-ledger/40" />
        </div>
      ))}
    </div>
  );
}

export function StatCardsSkeleton({ count = 2 }: { count?: number }) {
  const grid = count >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : count === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <div className={`grid gap-3 ${grid}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2 border border-rule bg-card p-5">
          <Sk className="h-3 w-2/3 !bg-ledger/40" />
          <Sk className="h-8 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-3 border border-rule bg-card p-4">
      <Sk className="h-5 w-40" />
      <Sk className="h-9 w-full !rounded-[4px]" />
      <div className="grid grid-cols-2 gap-3">
        <Sk className="h-9 !rounded-[4px]" />
        <Sk className="h-9 !rounded-[4px]" />
      </div>
      <Sk className="h-20 w-full !rounded-[4px]" />
      <Sk className="h-10 w-full !rounded-[4px] !bg-ledger/60" />
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-ledger/60 border border-rule bg-card px-4">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-3">
          <div className="flex-1 space-y-2">
            <Sk className="h-4 w-1/3" />
            <Sk className="h-3 w-2/3 !bg-ledger/40" />
          </div>
          <Sk className="h-5 w-16 !rounded-full" />
        </li>
      ))}
    </ul>
  );
}
