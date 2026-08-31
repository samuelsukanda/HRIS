import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-paper px-4 text-center">
      <div className="mb-6 inline-block border-2 border-dashed border-stamp/40 px-6 py-4">
        <p className="font-mono text-6xl font-bold text-stamp">404</p>
      </div>
      <h1 className="mb-2 text-xl font-bold tracking-tight text-ink">Halaman Tidak Ditemukan</h1>
      <p className="mb-6 max-w-sm text-sm leading-relaxed text-ink-soft">
        Dokumen yang Anda cari tidak tersedia dalam arsip kami. Periksa kembali URL atau kembali ke beranda.
      </p>
      <Link
        href="/"
        className="btn-press inline-block border border-official bg-official px-5 py-2 text-sm font-semibold text-white hover:bg-official-deep"
      >
        Kembali ke Beranda
      </Link>
    </div>
  );
}
