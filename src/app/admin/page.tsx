"use client";

import Link from "next/link";
import { WarningCircle } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { Avatar, EmptyState, StatusStamp } from "@/components/ui";
import { fmtDateID } from "@/lib/format";
import { currentUser, todayISO, useHris } from "@/lib/store";

export default function AdminDashboard() {
  const { state } = useHris();
  const { data } = state;
  const me = currentUser(state);
  const today = todayISO();

  const activeEmployees = data.employees.filter((e) => e.status === "active");
  const todayAtt = data.attendance.filter((a) => a.date === today);
  const count = (s: string) => todayAtt.filter((a) => a.status === s).length;

  const presentRows = [
    ["Hadir", count("present")],
    ["Terlambat", count("late")],
    ["WFH", count("wfh")],
    ["Cuti", count("leave")],
    ["Sakit", count("sick")],
    ["Izin", count("permission")],
    ["Tidak hadir", count("absent")],
  ] as [string, number][];
  const totalToday = Math.max(1, todayAtt.length);
  const maxRow = Math.max(...presentRows.map(([, n]) => n), 1);

  const checkedIn = todayAtt.filter((a) => a.checkInAt).length;
  const belumAbsen = activeEmployees.length - checkedIn - todayAtt.filter((a) => !a.checkInAt && a.status !== "present" && a.status !== "late").length;

  const needsReview = data.attendance.filter(
    (a) => a.date === today && (a.riskScore >= 60 || a.verificationStatus === "review"),
  );
  const pendingLeave = data.leaveRequests.filter((r) => r.status === "pending");
  const pendingOT = data.overtimeRequests.filter((r) => r.status === "pending");
  const pendingCorrections = data.attendance.flatMap((a) =>
    a.corrections.filter((c) => c.status === "pending").map((c) => ({ att: a, c })),
  );
  const followUpEmployees = data.employees.filter((e) => e.status === "active" && (e.employmentType === "probation" || e.employmentType === "contract"));
  const isManager = me?.user.role === "manager";

  return (
    <>
      <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5, ease:[0.16,1,0.3,1] }} className="mb-8">
        <p className="font-mono text-xs tracking-widest text-ink-faint uppercase">{fmtDateID(today)}</p>
        <h1 className="mt-1 text-4xl font-bold tracking-tighter leading-none">
          Selamat bertugas{me ? `, ${me.employee.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-ink-soft">
          {isManager ? "Ringkasan tim dan pengajuan yang menunggu persetujuan Anda." : "Ringkasan kehadiran seluruh lokasi hari ini — bento ledger yang hidup."}
        </p>
      </motion.div>

      <motion.div initial="hidden" animate="visible" variants={{ hidden:{}, visible:{ transition:{ staggerChildren:0.08 }}}} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_380px]">
        {/* Kolom buku kas kehadiran — bento with diffusion shadow */}
        <motion.section variants={{ hidden:{ opacity:0, y:12 }, visible:{ opacity:1, y:0, transition:{ type:"spring", stiffness:100, damping:20 }}}} className="rounded-[1.5rem] border border-slate-200/60 bg-white shadow-[0_20px_40px_-20px_rgba(0,0,0,0.08)]">
          <header className="flex items-baseline justify-between border-b border-rule px-5 py-3.5">
            <h2 className="font-semibold">Kehadiran Hari Ini</h2>
            <span className="tnum text-xs text-ink-faint">
              {checkedIn}/{activeEmployees.length} sudah check-in
            </span>
          </header>
          <ul className="px-5 py-2">
            {presentRows.map(([label, n]) => (
              <li key={label} className="flex items-center gap-4 border-b border-ledger/60 py-2.5 last:border-b-0">
                <span className="w-24 shrink-0 text-sm text-ink-soft">{label}</span>
                <span className="tnum w-10 shrink-0 text-right font-semibold">{n}</span>
                <span className="h-1.5 flex-1 bg-paper" aria-hidden>
                  <span
                    className={`block h-full ${["Hadir", "WFH"].includes(label) ? "bg-official" : label === "Terlambat" ? "bg-stamp" : "bg-ledger"}`}
                    style={{ width: `${Math.round((n / maxRow) * 100)}%` }}
                  />
                </span>
                <span className="tnum w-12 shrink-0 text-right text-xs text-ink-faint">
                  {Math.round((n / totalToday) * 100)}%
                </span>
              </li>
            ))}
          </ul>
          <footer className="border-t border-rule bg-paper px-5 py-3 text-sm text-ink-soft">
            Belum absen: <b className="tnum text-ink">{belumAbsen}</b> karyawan ·{" "}
            <Link href="/admin/jadwal" className="font-medium text-official underline underline-offset-2 hover:text-official-deep">
              lihat papan jadwal →
            </Link>
          </footer>
        </motion.section>

        {/* Tabel kehadiran hari ini — janji FIRST VIEWPORT */}
        <motion.section variants={{ hidden:{ opacity:0, y:12 }, visible:{ opacity:1, y:0, transition:{ delay:0.1, type:"spring", stiffness:100, damping:20 }}}} className="mt-6 rounded-[1.5rem] border border-slate-200/60 bg-white shadow-[0_20px_40px_-20px_rgba(0,0,0,0.08)]">
          <header className="flex items-baseline justify-between border-b border-rule px-5 py-3.5">
            <h2 className="font-semibold">Rekaman Hari Ini</h2>
            <Link href="/admin/absensi" className="text-xs font-medium text-official underline underline-offset-2 hover:text-official-deep">
              review lengkap →
            </Link>
          </header>
          <ul className="divide-y divide-ledger/60 px-5">
            {todayAtt
              .filter((a) => a.checkInAt)
              .sort((a, b) => (b.checkInAt ?? "").localeCompare(a.checkInAt ?? ""))
              .slice(0, 8)
              .map((a) => {
                const emp = data.employees.find((e) => e.id === a.employeeId)!;
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate font-medium">{emp.name}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="tnum text-xs text-ink-soft">
                        {a.checkInAt ? new Date(a.checkInAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </span>
                      <span className={`tnum w-8 text-right text-xs ${a.riskScore >= 60 ? "font-semibold text-stamp-deep" : "text-ink-faint"}`}>
                        {a.riskScore}
                      </span>
                      <StatusStamp status={a.status} />
                    </span>
                  </li>
                );
              })}
            {todayAtt.filter((a) => a.checkInAt).length === 0 && (
              <li className="py-4 text-sm text-ink-soft">Belum ada check-in hari ini.</li>
            )}
          </ul>
        </motion.section>

        {/* Alert arsip — bento right column */}
        <motion.aside variants={{ hidden:{ opacity:0, y:12 }, visible:{ opacity:1, y:0, transition:{ delay:0.15, type:"spring", stiffness:100, damping:20 }}}} className="space-y-6">
          <section className="border border-rule bg-card">
            <header className="border-b border-rule px-5 py-3.5">
              <h2 className="font-semibold">Alert Arsip</h2>
            </header>
            <ul className="divide-y divide-ledger/60 px-5">
              <AlertRow n={needsReview.length} label="absensi berisiko tinggi perlu review" href="/admin/absensi" />
              <AlertRow n={pendingLeave.length} label="pengajuan cuti pending" href="/admin/cuti" />
              <AlertRow n={pendingOT.length} label="pengajuan lembur pending" href="/admin/lembur" />
              <AlertRow n={pendingCorrections.length} label="koreksi absensi menunggu keputusan" href="/admin/absensi" />
              <li className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="text-ink-soft">pegawai probation/kontrak perlu follow-up</span>
                <span className="flex items-center gap-2"><span className="tnum text-xs font-semibold text-ink">{followUpEmployees.length}</span><StatusStamp status={followUpEmployees.length > 0 ? "pending" : "approved"} /></span>
              </li>
            </ul>
          </section>

          <section className="border border-rule bg-card">
            <header className="border-b border-rule px-5 py-3.5">
              <h2 className="font-semibold">Pengumuman Terbaru</h2>
            </header>
            <ul className="divide-y divide-ledger/60">
              {data.announcements.slice(0, 3).map((a) => (
                <li key={a.id} className="px-5 py-3">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-soft">{a.body}</p>
                </li>
              ))}
            </ul>
          </section>
        </motion.aside>
      </motion.div>

      {/* Perlu review — bento wide with breathing dots */}
      <motion.section initial={{ opacity:0 }} whileInView={{ opacity:1 }} viewport={{ once:true }} className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Perlu Review — Risk Engine</h2>
          <Link href="/admin/absensi" className="text-sm font-medium text-official underline underline-offset-2 hover:text-official-deep">
            Semua absensi →
          </Link>
        </div>
        {needsReview.length === 0 ? (
          <EmptyState
            icon={WarningCircle}
            title="Tidak ada anomali hari ini"
            body="Risk engine tidak menemukan absensi dengan skor risiko tinggi. Rekaman baru dengan indikasi fraud akan muncul di sini."
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {needsReview.map((a) => {
              const emp = data.employees.find((e) => e.id === a.employeeId)!;
              return (
                <li key={a.id} className="flex items-start gap-3 border border-rule bg-card p-4">
                  <Avatar name={emp.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="font-semibold">{emp.name}</p>
                      <StatusStamp status={a.riskScore >= 60 ? "high" : "medium"} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-soft">
                      {a.rejectionReason ?? a.checkInSnap?.stages.find((s) => !s.pass)?.detail ?? "Pola tidak biasa terdeteksi oleh risk engine."}
                    </p>
                    <p className="tnum mt-2 text-xs text-ink-faint">
                      RISK {a.riskScore}/100 · {a.checkInAt ? new Date(a.checkInAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "—"} ·{" "}
                      {emp.id}
                    </p>
                  </div>
                  <Link href="/admin/absensi" className="btn-press shrink-0 cursor-pointer self-center rounded-[4px] border border-rule px-3 py-1.5 text-xs font-semibold hover:border-official">
                    Review
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </motion.section>
    </>
  );
}

function AlertRow({ n, label, href }: { n: number; label: string; href: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3 text-sm">
      <span className="text-ink-soft">
        <b className="tnum text-ink">{n}</b> {label}
      </span>
      <Link href={href} aria-label={`Buka ${label}`} className="shrink-0 text-official hover:text-official-deep">
        →
      </Link>
    </li>
  );
}
