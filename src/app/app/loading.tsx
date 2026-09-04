import { Sk } from "@/components/skeletons";

export default function AppLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Memuat beranda">
      <div className="rounded-[1.5rem] border border-rule bg-card">
        <div className="flex items-center justify-between border-b border-rule px-5 py-3">
          <Sk className="h-3 w-32" />
          <Sk className="h-4 w-16" />
        </div>
        <div className="space-y-3 px-5 py-5">
          <Sk className="h-3 w-24 !bg-ledger/40" />
          <Sk className="h-8 w-48" />
          <Sk className="h-4 w-40 !bg-ledger/40" />
          <Sk className="h-12 w-full !rounded-[4px] !bg-ledger/60" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-2 rounded-[1.25rem] border border-rule bg-card p-5">
            <Sk className="h-3 w-20 !bg-ledger/40" />
            <Sk className="h-6 w-24" />
            <Sk className="h-3 w-16 !bg-ledger/40" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-[1.35fr_0.65fr]">
        <Sk className="h-24 rounded-[1.25rem] border border-rule bg-card" />
        <div className="grid gap-4">
          <Sk className="h-10 rounded-[1.25rem] border border-rule bg-card" />
          <Sk className="h-10 rounded-[1.25rem] border border-rule bg-card" />
        </div>
      </div>
    </div>
  );
}
