"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldCheck } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { currentUser, useHris } from "@/lib/store";
import { alertAccountDisabled } from "@/lib/swal";

export default function LoginPage() {
  const { state, login } = useHris();
  const router = useRouter();
  const me = currentUser(state);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me && state.session) {
      router.replace(me.user.role === "employee" ? "/app" : "/admin");
    }
  }, [me, state.session, router]);

  async function doLogin(em: string, pw: string) {
    setBusy(true);
    setError(null);
    const err = await login(em, pw).catch(() => "Tidak dapat menghubungi server. Coba lagi.");
    setBusy(false);
    if (!err) return;
    setError(err);
    if (err.toLowerCase().includes("dinonaktifkan")) void alertAccountDisabled();
  }

  return (
    <main className="grid min-h-[100dvh] lg:grid-cols-[1.15fr_0.85fr]">
      {/* Panel identitas — asymmetric bento with liquid glass */}
      <section className="relative hidden flex-col overflow-hidden border-r border-rule bg-card px-12 py-12 lg:flex">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_20%_80%,rgba(220,38,38,0.06),transparent_50%),radial-gradient(ellipse_at_80%_20%,rgba(14,165,233,0.06),transparent_50%)]" />
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16,1,0.3,1] }} className="flex items-center gap-2 font-mono text-xs tracking-widest text-ink-soft uppercase">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-stamp opacity-30" /><span className="relative inline-flex h-2 w-2 rounded-full bg-stamp" /></span>
          HRIS — Human Resource Information System
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6, ease: [0.16,1,0.3,1] }} className="flex max-w-[30ch] flex-1 flex-col justify-center">
          <p className="text-5xl leading-[0.95] font-extrabold tracking-tighter text-balance">
            <em className="text-stamp not-italic underline decoration-stamp/40 decoration-4 underline-offset-8">Satu sistem.</em> <span className="whitespace-nowrap">Seluruh proses HR.</span>
          </p>
          <p className="mt-6 max-w-[52ch] text-sm leading-relaxed text-ink-soft">
            Kelola kehadiran, karyawan, payroll, cuti, performa, dan berbagai
            proses HR dalam satu sistem terintegrasi.
          </p>
        </motion.div>
      </section>

      {/* Panel masuk */}
      <section className="flex flex-col justify-center px-6 py-12 sm:px-14">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <ShieldCheck size={20} weight="duotone" className="text-stamp" />
            <span className="font-mono text-xs tracking-widest uppercase">HRIS</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Masuk</h1>
          <p className="mt-1 mb-6 text-sm text-ink-soft">
            Masuk menggunakan akun perusahaan Anda untuk mengakses sistem HRIS.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void doLogin(email, password);
            }}
            className="space-y-3"
          >
            <div>
              <label htmlFor="email" className="mb-1 block font-mono text-[11px] tracking-widest text-ink-faint uppercase">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@hris.id"
                className="w-full border border-rule bg-card px-3 py-2.5 text-sm outline-none focus:border-official"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block font-mono text-[11px] tracking-widest text-ink-faint uppercase">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-rule bg-card px-3 py-2.5 text-sm outline-none focus:border-official"
              />
            </div>
            {error && (
              <p role="alert" className="border border-stamp/40 bg-stamp/5 px-3 py-2 text-sm text-stamp-deep">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="btn-press w-full cursor-pointer bg-ink px-4 py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
            >
              {busy ? "Memeriksa…" : "Masuk"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
