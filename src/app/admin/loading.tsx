export default function AdminLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-paper">
      <div className="w-full max-w-md space-y-3 px-4">
        <div className="h-24 animate-pulse border border-rule bg-card" />
        <div className="h-40 animate-pulse border border-rule bg-card" />
        <p className="text-center font-mono text-xs tracking-widest text-ink-faint uppercase">Memuat data admin…</p>
      </div>
    </div>
  );
}
