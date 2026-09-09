"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Briefcase, Fingerprint, GraduationCap, HandHeart, Megaphone, NotePencil, Package, Wallet } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { Stamp } from "@/components/ui";
import { leaveBalance } from "@/lib/engine";
import { fmtClockFromDate, fmtDateID } from "@/lib/format";
import { currentUser, rosterShiftFor, todayISO, useHris } from "@/lib/store";

export default function EmployeeHome() {
  const { state } = useHris();
  const { data } = state;
  const me = currentUser(state);
  const today = todayISO();
  const [now, setNow] = useState<Date | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-gate: component renders after HrisProvider ready, so this is client-only
  useEffect(() => { const t = new Date(); setNow(t); }, []);
  const shift = me ? rosterShiftFor(data, me.employee.id, today) : null;
  const attToday = me ? data.attendance.find((a) => a.employeeId === me.employee.id && a.date === today) : null;
  const myLeave = me ? data.leaveRequests.filter((r) => r.employeeId === me.employee.id) : [];
  const pendingMine = myLeave.filter((r) => r.status === "pending").length;
  const annual = data.leaveTypes[0];
  const annualBal = annual
    ? leaveBalance(annual.allocationDays, myLeave.filter((r) => r.typeId === annual.id))
    : { remaining: 0, allocation: 0, used: 0, pending: 0 };
  const loc = me ? data.workLocations.find((w) => w.id === me.employee.workLocationId) : null;
  const jamSekarang = now?.getHours() ?? 12;
  const salam = jamSekarang < 11 ? "Selamat pagi" : jamSekarang < 15 ? "Selamat siang" : jamSekarang < 18 ? "Selamat sore" : "Selamat malam";
  if (!me) return null;
  const { employee } = me;

  return (
    <motion.div initial="hidden" animate="visible" variants={{ hidden:{}, visible:{ transition:{ staggerChildren:0.06 }}}} className="space-y-4">
      {/* Kartu shift hari ini — bento with breathing indicator */}
      <motion.section variants={{ hidden:{ opacity:0, y:10 }, visible:{ opacity:1, y:0, transition:{ type:"spring", stiffness:100, damping:20 }}}} aria-label="Shift hari ini" className="rounded-[1.5rem] border border-slate-200/60 bg-white shadow-[0_20px_40px_-20px_rgba(0,0,0,0.08)]">
        <header className="flex items-center justify-between border-b border-rule px-5 py-3">
          <p className="font-mono text-[10px] tracking-widest text-ink-faint uppercase">{fmtDateID(today)}</p>
          <p className="tnum font-mono text-sm font-semibold">{now ? fmtClockFromDate(now) : "—"}</p>
        </header>
        <div className="px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <p className="text-xs tracking-wide text-ink-faint uppercase">Jadwal hari ini</p>
              <p className="tnum mt-1 text-2xl font-bold tracking-tight">
                {shift ? `${shift.start} – ${shift.end}` : "Libur"}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {shift ? shift.name : "Tidak ada jadwal kerja hari ini"}
                {loc && shift ? ` · ${loc.name.split("—")[0]?.trim()}` : ""}
              </p>
            </div>
            {attToday ? (
              <StatusBlock att={attToday} />
            ) : (
              <Stamp kind={shift ? "pending" : "neutral"}>{shift ? "Belum absen" : "Off"}</Stamp>
            )}
          </div>

          {shift && (
            <Link
              href="/app/absensi"
              className={`btn-press mt-5 flex cursor-pointer items-center justify-between border px-4 py-3.5 font-semibold ${
                !employee.faceRegistered
                  ? "pointer-events-none border-dashed border-rule bg-paper text-ink-faint"
                  : attToday?.checkInAt
                    ? "border-rule bg-card text-official-deep hover:border-official"
                    : "border-stamp-deep bg-stamp text-white hover:bg-stamp-deep"
              }`}
            >
              <span className="flex items-center gap-2">
                <Fingerprint size={20} weight="duotone" />
                {!employee.faceRegistered
                  ? "Daftarkan wajah dahulu untuk absen"
                  : (attToday?.checkInAt ? "Check Out Sekarang" : "Check In Sekarang")}
              </span>
              <ArrowRight size={17} weight="bold" />
            </Link>
          )}
          {attToday?.checkInAt && !attToday.checkOutAt && (
            <p className="tnum mt-2 text-center text-xs text-ink-faint">
              Check-in tercatat {fmtClockFromDate(new Date(attToday.checkInAt))} · risk {attToday.riskScore}/100
            </p>
          )}
        </div>
      </motion.section>

      {/* Ringkasan cepat — bento 2x2 asymmetric, no 3-col */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div variants={{ hidden:{ opacity:0, y:8 }, visible:{ opacity:1, y:0 }}}><QuickCard
          href="/app/cuti"
          icon={HandHeart}
          title="Annual Leave"
          value={annual ? `${annualBal.remaining}/${annual.allocationDays} hari` : "—"}
          sub={pendingMine > 0 ? `saldo tersisa · ${pendingMine} pending` : "saldo tersisa"}
        /></motion.div>
        <motion.div variants={{ hidden:{ opacity:0, y:8 }, visible:{ opacity:1, y:0 }}}><QuickCard
          href="/app/payslip"
          icon={Wallet}
          title="Slip Gaji"
          value="Payslip"
          sub="riwayat gaji →"
        /></motion.div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1.35fr_0.65fr]">
        <motion.div variants={{ hidden:{ opacity:0, y:8 }, visible:{ opacity:1, y:0 }}}><QuickCard
          href="/app/reimbursements"
          icon={Wallet}
          title="Reimburse"
          value="Biaya"
          sub="ajukan reimbursement →"
        /></motion.div>
        <div className="grid gap-4">
          <motion.div variants={{ hidden:{ opacity:0, y:8 }, visible:{ opacity:1, y:0 }}}><QuickCard
            href="/app/pelatihan"
            icon={GraduationCap}
            title="Pelatihan"
            value="Kelas"
            sub="jadwal →"
          /></motion.div>
          <motion.div variants={{ hidden:{ opacity:0, y:8 }, visible:{ opacity:1, y:0 }}}><QuickCard
            href="/app/aset"
            icon={Package}
            title="Aset"
            value="Inventaris"
            sub="saya →"
          /></motion.div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <motion.div variants={{ hidden:{ opacity:0, y:8 }, visible:{ opacity:1, y:0 }}}><QuickCard
          href="/app/lembur"
          icon={Briefcase}
          title="Lembur"
          value="Overtime"
          sub="ajukan lembur →"
        /></motion.div>
        <motion.div variants={{ hidden:{ opacity:0, y:8 }, visible:{ opacity:1, y:0 }}}><QuickCard
          href="/app/performa"
          icon={NotePencil}
          title="Performa"
          value="Review"
          sub="penilaian saya →"
        /></motion.div>
      </div>

      {/* Pengumuman */}
      <section className="mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <Megaphone size={16} weight="duotone" className="text-stamp" /> Pengumuman
          </h2>
          <Link href="/app/pengumuman" className="text-xs font-medium text-official underline underline-offset-2 hover:text-official-deep">
            lihat semua →
          </Link>
        </div>
        <ul className="divide-y divide-ledger/60 border border-rule bg-card">
          {data.announcements.map((a) => (
            <li key={a.id} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold">{a.title}</p>
                <span className="tnum shrink-0 text-[10px] text-ink-faint uppercase">{a.category}</span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{a.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-6 px-2 text-[11px] leading-relaxed text-ink-faint">
        {salam}, {employee.name.split(" ")[0]}. Lokasi Anda hanya diakses saat menekan tombol
        check-in — tidak ada pelacakan di luar itu.
      </p>
    </motion.div>
  );
}

function StatusBlock({ att }: { att: { status: string; checkInAt?: string; verificationStatus: string } }) {
  if (!att.checkInAt) return <Stamp kind="neutral">{att.status}</Stamp>;
  const ok = att.verificationStatus === "valid" || att.verificationStatus === "review";
  return (
    <div className="text-right">
      <Stamp kind={ok ? "approved" : "rejected"}>{att.verificationStatus === "valid" ? "Present" : att.verificationStatus}</Stamp>
      <p className="tnum mt-1.5 text-xs text-ink-faint">in {fmtClockFromDate(new Date(att.checkInAt))}</p>
    </div>
  );
}

function QuickCard({
  href,
  icon: Icon,
  title,
  value,
  sub,
}: {
  href: string;
  icon: typeof HandHeart;
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <Link href={href} className="btn-press block rounded-[1.25rem] border border-slate-200/60 bg-white p-5 shadow-[0_12px_24px_-16px_rgba(0,0,0,0.08)] hover:border-zinc-300 transition-colors active:scale-[0.98]">
      <Icon size={18} weight="duotone" className="text-stamp" />
      <p className="mt-3 text-xs tracking-wide text-ink-faint uppercase">{title}</p>
      <p className="tnum mt-1 font-mono text-xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-ink-soft">{sub}</p>
    </Link>
  );
}
