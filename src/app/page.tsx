"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Fingerprint, GlobeSimple, ShieldCheck } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { currentUser, useHris } from "@/lib/store";

const DEMO_ACCOUNTS = [
  { email: "samuel.hartono@hrissmart.id", name: "Samuel Hartono", role: "HR Manager", desc: "Dashboard HR penuh, review absensi & risiko fraud, kelola karyawan, approval cuti/lembur." },
  { email: "ratna.wijaya@hrissmart.id", name: "Ratna Wijaya", role: "Supervisor Cabang", desc: "Pantau kehadiran tim Bandung dan setujui pengajuan subordinate." },
  { email: "budi.santoso@hrissmart.id", name: "Budi Santoso", role: "Karyawan", desc: "Check-in GPS + face + liveness, lihat shift, saldo cuti, dan riwayat." },
];

const DEMO_PASSWORD = "demo1234";

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
    const err = await login(em, pw);
    setBusy(false);
    if (err) setError(err);
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

          <motion.div initial="hidden" animate="visible" variants={{ hidden:{}, visible:{ transition:{ staggerChildren:0.07, delayChildren:0.2 }}}} className="mt-8">
            <p className="mb-2 font-mono text-[11px] tracking-widest text-ink-faint uppercase">Akun demo · password {DEMO_PASSWORD}</p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((r) => (
                <motion.button
                  key={r.email}
                  variants={{ hidden:{ opacity:0, y:8 }, visible:{ opacity:1, y:0, transition:{ type:"spring", stiffness:100, damping:20 }}}}
                  whileHover={{ y:-1 }} whileTap={{ scale:0.98 }}
                  disabled={busy}
                  onClick={() => {
                    setEmail(r.email);
                    setPassword(DEMO_PASSWORD);
                    void doLogin(r.email, DEMO_PASSWORD);
                  }}
                  className="group w-full cursor-pointer border border-rule bg-card p-3.5 text-left shadow-[0_8px_24px_-16px_rgba(0,0,0,0.12)] hover:border-official focus-visible:border-official disabled:opacity-60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold tracking-tight">{r.name}</span>
                    <span className="font-mono text-[11px] tracking-widest text-stamp uppercase group-hover:text-official">
                      {r.role} →
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-snug text-ink-soft">{r.desc}</p>
                </motion.button>
              ))}
            </div>
          </motion.div>

          <p className="mt-8 flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
            <GlobeSimple size={14} weight="light" className="mt-0.5 shrink-0" />
            Akses lokasi dan kamera hanya aktif saat Anda melakukan absensi dan tidak digunakan untuk pelacakan di luar proses tersebut.
          </p>
        </div>
      </section>
    </main>
  );
}
