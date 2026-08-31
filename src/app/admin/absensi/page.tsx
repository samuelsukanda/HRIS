"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Avatar, Btn, EmptyState, Input, Modal, PageHead, Pager, Select, StatusStamp, Stamp } from "@/components/ui";
import { fmtClockFromDate, toLocalISO } from "@/lib/format";
import { currentUser, useHris } from "@/lib/store";
import type { AttendanceRecord, WorkLocation } from "@/lib/types";

export default function AdminAttendance() {
  const { state, dispatch } = useHris();
  const { data } = state;
  const me = currentUser(state);
  const [date, setDate] = useState(() => toLocalISO(new Date()));
  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<{ attId: string; corrId: string; name: string } | null>(null);
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  const rows = useMemo(() => {
    return data.attendance
      .filter((a) => a.date === date)
      .filter((a) => statusFilter === "all" || a.status === statusFilter)
      .filter((a) => {
        if (!q.trim()) return true;
        const emp = data.employees.find((e) => e.id === a.employeeId)!;
        const hay = `${emp.name} ${emp.id} ${a.rejectionReason ?? ""}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
      .sort((a, b) => b.riskScore - a.riskScore);
  }, [data.attendance, data.employees, date, statusFilter, q]);

  const decideCorrection = (approve: boolean) => {
    if (!correctionTarget || !me) return;
    dispatch({
      type: "DECIDE_CORRECTION",
      attendanceId: correctionTarget.attId,
      correctionId: correctionTarget.corrId,
      approve,
      byName: me.employee.name,
    });
    setCorrectionTarget(null);
  };

  const pendingCount = rows.filter((r) => r.corrections.some((c) => c.status === "pending")).length;
  const paged = rows.slice((page - 1) * LIMIT, page * LIMIT);

  return (
    <>
      <PageHead
        title="Absensi"
        sub="Setiap rekaman membawa bukti berlapis: GPS, geofence, skor wajah, liveness, perangkat, dan skor risiko. Koreksi hanya lewat alur ini — jejak before/after tercatat di audit log."
        action={
          pendingCount > 0 ? (
            <span className="stamp stamp-pending">
              {pendingCount} koreksi menunggu
            </span>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="w-44">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Tanggal" />
        </div>
        <div className="w-40">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter status">
            <option value="all">Semua status</option>
            {["present", "late", "wfh", "leave", "sick", "permission", "absent"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div className="relative min-w-52 flex-1">
          <MagnifyingGlass size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
          <Input placeholder="Cari nama / ID karyawan…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={MagnifyingGlass} title="Tidak ada rekaman" body="Ubah tanggal atau filter untuk melihat rekaman absensi hari lain." />
      ) : (
        <div className="overflow-x-auto border border-rule bg-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-rule text-left font-mono text-[11px] tracking-widest text-ink-faint uppercase">
                <th className="px-4 py-2.5 font-medium">Karyawan</th>
                <th className="px-3 py-2.5 font-medium">Masuk</th>
                <th className="px-3 py-2.5 font-medium">Keluar</th>
                <th className="px-3 py-2.5 font-medium">GPS</th>
                <th className="px-3 py-2.5 font-medium">Wajah</th>
                <th className="px-3 py-2.5 font-medium">Live</th>
                <th className="px-3 py-2.5 font-medium">Risk</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((a) => {
                const emp = data.employees.find((e) => e.id === a.employeeId)!;
                const snap = a.checkInSnap;
                return (
                  <Row
                    key={a.id}
                    att={a}
                    empName={emp.name}
                    empNo={emp.id}
                    onToggle={() => setExpanded(expanded === a.id ? null : a.id)}
                    open={expanded === a.id}
                    onCorrect={(c) =>
                      setCorrectionTarget({ attId: a.id, corrId: c.id, name: emp.name })
                    }
                  >
                    {snap && (
                      <tr className="bg-paper">
                        <td colSpan={9} className="border-b border-rule px-4 pb-6">
                          <DetailPanel att={a} location={data.workLocations.find((w) => w.id === emp.workLocationId)!} />
                        </td>
                      </tr>
                    )}
                  </Row>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pager page={page} total={rows.length} limit={LIMIT} onChange={setPage} />

      <Modal open={!!correctionTarget} onClose={() => setCorrectionTarget(null)} title="Keputusan Koreksi Absensi">
        {correctionTarget && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-ink-soft">
              Koreksi diajukan oleh <b className="text-ink">{correctionTarget.name}</b>. Keputusan Anda akan dicatat
              di audit log beserta nilai sebelum/sesudah.
            </p>
            <div className="flex gap-3">
              <Btn variant="secondary" className="flex-1" onClick={() => decideCorrection(false)}>
                Tolak
              </Btn>
              <Btn className="flex-1" onClick={() => decideCorrection(true)}>
                Setujui &amp; Perbaiki Rekaman
              </Btn>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function Row({
  att,
  empName,
  empNo,
  children,
  open,
  onToggle,
  onCorrect,
}: {
  att: AttendanceRecord;
  empName: string;
  empNo: string;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  onCorrect: (c: AttendanceRecord["corrections"][number]) => void;
}) {
  const snap = att.checkInSnap;
  const pendingCorr = att.corrections.find((c) => c.status === "pending");
  return (
    <>
      <tr className={`border-b border-ledger/60 transition-colors hover:bg-black/[0.02] ${open ? "bg-paper" : ""}`}>
        <td className="px-4 py-2.5">
          <button onClick={onToggle} className="flex cursor-pointer items-center gap-2.5 text-left">
            <Avatar name={empName} size={30} />
            <span>
              <span className="block font-semibold">{empName}</span>
              <span className="tnum block text-xs text-ink-faint">{empNo}</span>
            </span>
          </button>
        </td>
        <td className="tnum px-3 py-2.5">{att.checkInAt ? fmtClockFromDate(new Date(att.checkInAt)) : "—"}</td>
        <td className="tnum px-3 py-2.5">{att.checkOutAt ? fmtClockFromDate(new Date(att.checkOutAt)) : "—"}</td>
        <td className="tnum px-3 py-2.5">
          {snap ? (snap.distanceM < 0 ? "WFH" : `${snap.distanceM} m`) : "—"}
        </td>
        <td className="tnum px-3 py-2.5">{snap ? `${Math.round(snap.faceScore * 100)}%` : "—"}</td>
        <td className="px-3 py-2.5">{snap ? (snap.livenessPassed ? <Stamp kind="approved">Pass</Stamp> : <Stamp kind="rejected">Fail</Stamp>) : "—"}</td>
        <td className="px-3 py-2.5">
          <span className={`tnum font-semibold ${att.riskScore >= 60 ? "text-stamp-deep" : att.riskScore >= 30 ? "text-ink" : "text-ink-faint"}`}>
            {att.riskScore}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex flex-wrap gap-1.5">
            <StatusStamp status={att.status} />
            {pendingCorr && <Stamp kind="pending">Koreksi</Stamp>}
          </div>
        </td>
        <td className="px-3 py-2.5 text-right">
          {pendingCorr && (
            <Btn variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => onCorrect(pendingCorr)}>
              Keputusan
            </Btn>
          )}
        </td>
      </tr>
      {open && children}
    </>
  );
}

function DetailPanel({ att, location }: { att: AttendanceRecord; location: WorkLocation }) {
  const snap = att.checkInSnap!;
  return (
    <div className="grid gap-6 pt-4 lg:grid-cols-[1fr_280px]">
      {/* Pipeline 01–07 */}
      <div>
        <h3 className="mb-2 font-mono text-[11px] tracking-widest text-ink-faint uppercase">
          Pipeline Validasi — Check In {fmtClockFromDate(new Date(snap.at))}
        </h3>
        <ol className="space-y-1">
          {snap.stages.map((s) => (
            <li key={s.stage} className={`flex items-start gap-3 rounded-[4px] px-2.5 py-1.5 ${s.pass ? "" : "bg-stamp/5"}`}>
              <span className="tnum mt-0.5 text-xs text-ink-faint">{String(s.stage).padStart(2, "0")}</span>
              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${s.pass ? "bg-official" : "bg-stamp"}`} aria-hidden />
              <span className="min-w-0">
                <span className="text-sm font-semibold">{s.name}</span>
                <span className="ml-2 text-sm text-ink-soft">{s.detail}</span>
              </span>
              {!s.pass && <Stamp kind="rejected">Gagal</Stamp>}
            </li>
          ))}
        </ol>

        {att.corrections.length > 0 && (
          <div className="mt-4 border-t border-rule pt-3">
            <h3 className="mb-2 font-mono text-[11px] tracking-widest text-ink-faint uppercase">Koreksi</h3>
            {att.corrections.map((c) => (
              <div key={c.id} className="rounded-[4px] bg-card p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <StatusStamp status={c.status} />
                  <span className="tnum text-xs text-ink-faint">{new Date(c.requestedAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="mt-2 leading-relaxed text-ink-soft">“{c.reason}”</p>
                {(c.beforeCheckIn || c.afterCheckIn) && (
                  <p className="tnum mt-2 text-xs">
                    <span className="text-ink-faint">BEFORE</span> {c.beforeCheckIn ? new Date(c.beforeCheckIn).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    {" → "}
                    <span className="text-ink-faint">AFTER</span> {c.afterCheckIn ? new Date(c.afterCheckIn).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Plot geofence + metadata perangkat */}
      <aside className="space-y-3">
        <GeofencePlot snap={snap} location={location} />
        <dl className="space-y-1.5 border border-rule bg-paper p-3 text-xs">
          <Meta k="Perangkat" v={snap.deviceName} mono />
          <Meta k="Device ID" v={snap.deviceId} mono />
          <Meta k="IP" v={snap.ip} mono />
          <Meta k="Akurasi GPS" v={`±${snap.accuracyM} m`} mono />
          <Meta k="Mock Location" v={snap.mockLocation ? "TRUE — ditolak" : "FALSE"} mono />
          <Meta k="Liveness" v={`${Math.round(snap.livenessScore * 100)}%`} mono />
        </dl>
      </aside>
    </div>
  );
}

function Meta({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-faint">{k}</dt>
      <dd className={`${mono ? "tnum" : ""} truncate text-right text-ink`}>{v}</dd>
    </div>
  );
}

/** Plot skematik posisi check-in terhadap radius geofence — geometri SVG murni */
function GeofencePlot({ snap, location }: { snap: NonNullable<AttendanceRecord["checkInSnap"]>; location: WorkLocation }) {
  const size = 240;
  const c = size / 2;
  const maxR = 100;
  const radiusPx = Math.min(maxR, (location.radiusM / Math.max(location.radiusM, snap.distanceM)) * maxR * 0.8);
  const distPx = Math.min(maxR, (snap.distanceM / Math.max(location.radiusM, snap.distanceM)) * maxR * 0.8);
  // Arah dari delta koordinat
  const dx = snap.longitude - location.longitude;
  const dy = snap.latitude - location.latitude;
  const angle = Math.atan2(dy, dx);
  const px = c + Math.cos(angle) * distPx;
  const py = c - Math.sin(angle) * distPx;

  return (
    <figure className="border border-rule bg-card p-3">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Plot posisi check-in terhadap radius lokasi kerja" className="mx-auto block">
        <circle cx={c} cy={c} r={radiusPx} fill="#2b4a6f08" stroke="#c4ceda" strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1={c} y1={c} x2={px} y2={py} stroke="#dbd9d0" strokeWidth="1" />
        <g>
          <rect x={c - 7} y={c - 7} width={14} height={14} fill="#2b4a6f" rx="1" />
          <path d={`M${c} ${c - 3} l0 6 M${c - 3} ${c} l6 0`} stroke="#fff" strokeWidth="1.4" />
        </g>
        {snap.distanceM >= 0 && (
          <g>
            <circle cx={px} cy={py} r={5.5} fill={snap.distanceM <= location.radiusM ? "#2b4a6f" : "#c03a2c"} stroke="#fcfbf7" strokeWidth="2" />
          </g>
        )}
        <text x={c} y={size - 6} textAnchor="middle" fontSize="10" fill="#8a8f97" fontFamily="var(--font-spline-sans-mono)">
          {location.name.split("—")[0]?.trim()}
        </text>
      </svg>
      <figcaption className="tnum mt-2 text-center text-xs text-ink-soft">
        {snap.distanceM < 0
          ? "Mode WFH — validasi lokasi kantor tidak diterapkan"
          : `Jarak ${snap.distanceM} m · radius ${location.radiusM} m`}
      </figcaption>
    </figure>
  );
}
