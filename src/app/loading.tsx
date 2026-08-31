export default function RootLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-paper">
      <div className="w-full max-w-sm space-y-3 px-4">
        <div className="h-28 animate-pulse border border-rule bg-card" />
        <div className="h-10 animate-pulse border border-rule bg-card" />
        <p className="text-center font-mono text-xs tracking-widest text-ink-faint uppercase">Memuat…</p>
      </div>
    </div>
  );
}
