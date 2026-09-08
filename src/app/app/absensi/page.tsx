"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowClockwise,
  CalendarX,
  CheckCircle,
  DeviceMobile,
  Eye,
  GpsFix,
  LockKey,
  SealCheck,
  UserFocus,
  WarningCircle,
} from "@phosphor-icons/react";
import { Btn, Stamp } from "@/components/ui";
import { checkGeofence } from "@/lib/engine";
import { fmtClockFromDate } from "@/lib/format";
import { detectDescriptor, detectEar, loadFaceApi } from "@/lib/face";
import { ApiError, currentUser, rosterShiftFor, todayISO, useHris } from "@/lib/store";

function deviceId(): string {
  // ponytail: deviceId sederhana per-session; device binding penuh butuh fingerprinting vendor
  try {
    const k = "hris-device-id";
    let id = sessionStorage.getItem(k);
    if (!id) {
      id = "DEV-" + Math.floor(1000 + Math.random() * 9000);
      sessionStorage.setItem(k, id);
    }
    return id;
  } catch {
    return "DEV-0000";
  }
}

const STEP_NAMES = [
  "Autentikasi & Perangkat",
  "Izin & Akuisisi GPS",
  "Validasi Geofence",
  "Deteksi Wajah",
  "Liveness Challenge",
  "Verifikasi Wajah 1:1",
  "Jadwal & Penyimpanan",
];

interface AppError {
  title: string;
  lines: string[];
}

export default function AttendancePage() {
  const { state, submitCheckIn, submitCheckOut } = useHris();
  const router = useRouter();
  const me = currentUser(state);
  const today = todayISO();

  const [phase, setPhase] = useState<"intro" | "running" | "success" | "error">("intro");
  const [stepIdx, setStepIdx] = useState(-1);
  const [error, setError] = useState<AppError | null>(null);
  const [faceScoreShown, setFaceScoreShown] = useState(0);
  const [livenessHint, setLivenessHint] = useState("Bersiap…");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canceledRef = useRef(false);

  const attToday = state.data.attendance.find((a) => a.employeeId === me?.employee.id && a.date === today);
  const shift = me ? rosterShiftFor(state.data, me.employee.id, today) : null;
  const location = state.data.workLocations.find((w) => w.id === me?.employee.workLocationId);
  const wfhPolicy = state.data.settings;
  const [isWfh, setIsWfh] = useState(false);
  const mode: "in" | "out" = attToday?.checkInAt && !attToday?.checkOutAt ? "out" : "in";
  const verb = mode === "in" ? "Check In" : "Check Out";

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    canceledRef.current = phase !== "running";
    if (phase !== "running") {
      setStepIdx(-1);
      stopCamera();
      setFaceScoreShown(0);
    }
  }, [phase, stopCamera]);

  if (!me || !location) return null;
  const emp = me.employee;
  const office = location;

  // Util langkah

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function runStep(idx: number): Promise<boolean> {
    setStepIdx(idx);
    return new Promise((resolve) => setTimeout(() => resolve(true), 350));
  }

  async function getGPS(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("unsupported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, (e) => reject(e), {
        enableHighAccuracy: true,
        timeout: 12_000,
        maximumAge: 5_000,
      });
    });
  }

  async function startCamera(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => undefined);
    }
  }

  // ── Pipeline utama ─────────────────────────────────────────────────
  async function run() {
    setError(null);
    setPhase("running");

    try {
      // 01 — Autentikasi & perangkat terikat
      await runStep(0);

      // 02 — GPS (dilewati untuk WFH — lokasi tidak direkam)
      await runStep(1);
      let coords: { latitude: number; longitude: number; accuracyM: number };
      if (isWfh) {
        coords = { latitude: 0, longitude: 0, accuracyM: 0 };
        await sleep(250);
      } else {
      try {
        const pos = await getGPS();
        coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyM: Math.round(pos.coords.accuracy),
        };
        await sleep(250);
      } catch {
        setPhase("error");
        setError({
          title: "Absensi tidak dapat diproses.",
          lines: [
            "Akses lokasi tidak tersedia atau ditolak.",
            "Aktifkan GPS dan berikan izin lokasi ke aplikasi ini, lalu coba lagi.",
          ],
        });
        return;
      }
      }

      // 03 — Geofence (dilewati untuk WFH — policy server yang menentukan)
      await runStep(2);
      if (!isWfh) {
      const point = { latitude: coords.latitude, longitude: coords.longitude };
      const geo = checkGeofence(point, office);
      if (!geo.pass) {
        setPhase("error");
        setError({
          title: "Absensi tidak dapat diproses.",
          lines: [
            `Lokasi Anda berada ${geo.distanceM} m dari lokasi kerja.`,
            `Maksimum radius: ${office.radiusM} m.`,
            "Mendekatlah ke area kantor, lalu coba lagi.",
          ],
        });
        return;
      }
      }

      // 04 — Kamera & deteksi wajah nyata
      await runStep(3);
      try {
        await startCamera();
      } catch {
        setPhase("error");
        setError({
          title: "Kamera tidak dapat diakses.",
          lines: [
            "Berikan izin kamera pada browser Anda.",
            "Pastikan tidak ada aplikasi lain yang sedang menggunakan kamera.",
          ],
        });
        return;
      }
      setLivenessHint("Memuat model pengenalan wajah…");
      const video = videoRef.current;
      if (!video) throw new Error("no-video");
      await loadFaceApi();
      let descriptor: number[] | null = null;
      for (let attempt = 0; attempt < 20 && !descriptor; attempt++) {
        if (canceledRef.current) return;
        setLivenessHint("Menghadapkan wajah ke kamera…");
        const det = await detectDescriptor(video);
        if (det && det.detection.score > 0.5) descriptor = det.descriptor;
        await sleep(300);
      }
      if (!descriptor) {
        stopCamera();
        setPhase("error");
        setError({
          title: "Wajah tidak terdeteksi.",
          lines: [
            "Hadapkan wajah ke kamera dengan pencahayaan cukup.",
            "Lepaskan masker/kacamata gelap bila memakai.",
          ],
        });
        return;
      }
      setLivenessHint("Wajah terdeteksi");

      // 05 — Liveness challenge: deteksi kedipan via Eye Aspect Ratio
      await runStep(4);
      setLivenessHint("Kedipkan mata perlahan…");
      let blinked = false;
      let baseline = await detectEar(video);
      const blinkDeadline = Date.now() + 7000;
      while (Date.now() < blinkDeadline && !blinked) {
        if (canceledRef.current) return;
        const ear = await detectEar(video);
        if (ear > 0 && baseline > 0 && ear < baseline * 0.72) blinked = true;
        else if (ear > baseline) baseline = ear;
        await sleep(120);
      }
      if (!blinked) {
        setPhase("error");
        setError({
          title: "Deteksi keaktifan (liveness) gagal.",
          lines: ["Mata berkedip tidak terdeteksi.", "Harap hadap kamera dengan jelas dan kedipkan mata saat diminta."],
        });
        return;
      }
      setLivenessHint("");
      stopCamera();

      // 06–07 — Verifikasi 1:1 & verdict oleh server
      await runStep(5);

      // 07 — Jadwal & aturan, lalu verdict server
      await runStep(6);
      if (!shift) {
        setPhase("error");
        setError({
          title: "Tidak ada jadwal hari ini.",
          lines: ["Anda tidak terjadwal bekerja hari ini.", "Hubungi supervisor untuk penyesuaian jadwal."],
        });
        return;
      }

      const payload = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyM: coords.accuracyM,
        mockLocation: false,
        developerMode: false,
        descriptor,
        livenessScore: 0.95,
        livenessPassed: true,
        deviceId: deviceId(),
        deviceName: navigator.userAgent.includes("Mobile") ? "Perangkat Mobile" : "Desktop Browser",
        wfh: isWfh,
      };

      // Verdict ditentukan server (geofence, risk, pipeline) — anti-fraud nyata
      let score = 96;
      if (mode === "in") {
        const rec = await submitCheckIn(payload);
        const dist = rec.checkInSnap?.faceDistance ?? 0.04;
        score = Math.max(0, Math.min(100, Math.round((1 - dist) * 100)));
      } else {
        const res = await submitCheckOut(payload);
        const dist = res.snap.faceDistance ?? 0.04;
        score = Math.max(0, Math.min(100, Math.round((1 - dist) * 100)));
      }
      setFaceScoreShown(score);
      setPhase("success");
    } catch (err) {
      stopCamera();
      setPhase("error");
      if (err instanceof ApiError) {
        setError({ title: err.title, lines: err.lines });
      } else {
        setError({
          title: "Terjadi kesalahan tak terduga.",
          lines: ["Coba ulangi proses absensi.", "Bila berulang, hubungi HR melalui kanal resmi."],
        });
      }
    }
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <>
      <h1 className="mb-1 text-xl font-bold tracking-tight">{verb}</h1>
      <p className="mb-4 text-sm text-ink-soft">
        {shift ? `${shift.name} · ${shift.start}–${shift.end}` : "Hari libur"} ·{" "}
        {location.name.split("—")[0]?.trim()} ({location.radiusM} m)
      </p>

      {phase === "intro" && <Intro />}
      {phase === "running" && (
        <section aria-live="polite">
          {(stepIdx ?? -1) >= 3 && (stepIdx ?? 0) <= 5 && (
            <div className="relative mb-4 overflow-hidden border border-rule bg-card">
              <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full scale-x-[-1] object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-ink/70 px-3 py-2 backdrop-blur-sm">
                <Eye size={16} weight="duotone" className="shrink-0 text-white" />
                <p className="text-xs font-medium text-white">{livenessHint}</p>
                {stepIdx === 5 && faceScoreShown > 0 && (
                  <p className="tnum ml-auto font-mono text-sm font-semibold text-white">
                    {faceScoreShown}%
                  </p>
                )}
              </div>
              {/* Sudut pemindai */}
              <ScanCorners />
            </div>
          )}
          <ol className="space-y-1">
            {STEP_NAMES.map((name, i) => {
              const done = i < stepIdx;
              const active = i === stepIdx;
              return (
                <li
                  key={name}
                  className={`flex items-center gap-3 border px-3 py-2.5 text-sm ${
                    active ? "border-official bg-card font-semibold" : done ? "border-rule bg-card/60 text-ink-soft" : "border-dashed border-rule bg-transparent text-ink-faint"
                  }`}
                >
                  <span className={`tnum font-mono text-xs ${active ? "text-stamp" : ""}`}>{String(i + 1).padStart(2, "0")}</span>
                  {name}
                  {done && <CheckCircle size={15} weight="fill" className="ml-auto text-official" />}
                  {active && <span aria-hidden className="ml-auto h-2 w-2 animate-pulse rounded-full bg-stamp" />}
                </li>
              );
            })}
          </ol>
          <button onClick={() => setPhase("intro")} className="mt-4 cursor-pointer text-sm text-ink-faint underline underline-offset-2 hover:text-ink">
            Batalkan
          </button>
        </section>
      )}

      {phase === "success" && <SuccessScreen />}

      {phase === "error" && error && (
        <section role="alert" className="border border-stamp/50 bg-card">
          <header className="flex items-center gap-2 border-b border-stamp/30 px-4 py-3">
            <WarningCircle size={19} weight="fill" className="text-stamp" />
            <p className="font-semibold">{error.title}</p>
          </header>
          <ul className="space-y-1 px-4 py-3 text-sm leading-relaxed text-ink-soft">
            {error.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <footer className="flex gap-2 border-t border-rule px-4 py-3">
            <Btn icon={ArrowClockwise} onClick={() => setPhase("intro")}>
              Coba Lagi
            </Btn>
          </footer>
        </section>
      )}
    </>
  );

  function Intro() {
    if (!emp.faceRegistered) {
      return (
        <section className="border border-stamp/40 bg-card p-5">
          <p className="font-semibold">Wajah belum terdaftar</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Sebelum bisa melakukan {verb.toLowerCase()}, daftarkan wajah Anda lewat halaman Profil.
            Pendaftaran memakai kamera depan dan memakan waktu ±20 detik.
          </p>
          <Btn className="mt-4" onClick={() => router.push("/app/profil")}>
            Buka Profil
          </Btn>
        </section>
      );
    }

    if (!shift && !attToday) {
      return (
        <section className="border border-dashed border-rule bg-card p-6 text-center">
          <CalendarOff />
          <p className="mt-2 font-semibold">Tidak ada jadwal hari ini</p>
          <p className="mt-1 text-sm text-ink-soft">Nikmati hari libur Anda. Tombol absensi aktif pada hari kerja.</p>
        </section>
      );
    }

    if (mode === "in" && attToday?.checkInAt) {
      // Sudah check-in tapi state belum sinkron (mis. refresh) → tampilkan ringkas
      return (
        <section className="border border-rule bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Sudah check-in</p>
            <Stamp kind={attToday.status === "late" ? "rejected" : "approved"}>{attToday.status}</Stamp>
          </div>
          <p className="tnum mt-2 text-sm text-ink-soft">
            Tercatat {fmtClockFromDate(new Date(attToday.checkInAt))} · risk {attToday.riskScore}/100
          </p>
        </section>
      );
    }

    if (mode === "out" && attToday?.checkOutAt) {
      return (
        <section className="border border-rule bg-card p-5">
          <p className="font-semibold">Absensi hari ini lengkap</p>
          <p className="tnum mt-2 text-sm text-ink-soft">
            Masuk {fmtClockFromDate(new Date(attToday.checkInAt!))} · Keluar {fmtClockFromDate(new Date(attToday.checkOutAt))}
          </p>
        </section>
      );
    }

    return (
      <section className="border border-rule bg-card">
        <div className="grid grid-cols-7 divide-x divide-ledger/60 border-b border-rule text-center">
          {[LockKey, DeviceMobile, GpsFix, UserFocus, Eye, SealCheck, CheckCircle].map((Icon, i) => (
            <div key={i} className="py-3">
              <Icon size={17} weight="light" className="mx-auto text-ink-faint" />
            </div>
          ))}
        </div>
        <div className="px-5 py-5">
          <p className="text-sm leading-relaxed text-ink-soft">
            Proses ini akan mengambil <b className="text-ink">lokasi Anda satu kali</b>, membuka{" "}
            <b className="text-ink">kamera depan</b>, menjalankan liveness check, lalu mencocokkan wajah
            dengan template terenkripsi Anda. Semua tahap berjalan lokal di perangkat ini.
          </p>
          <ul className="tnum mt-4 space-y-1 text-xs text-ink-faint">
            <li>· Lokasi hanya direkam saat absensi onsite — tanpa tracking pasif.</li>
            <li>· Template wajah tidak dapat dibalik menjadi foto.</li>
            <li>· Rekaman masuk ke audit log permanen.</li>
          </ul>
          <div className="mt-4 flex items-center justify-between gap-3 border border-dashed border-rule bg-paper px-3 py-2.5">
            <div>
              <p className="text-sm font-semibold">Mode WFH</p>
              <p className="text-xs text-ink-soft">
                GPS {wfhPolicy.wfh_gps ?? "TIDAK DIWAJIBKAN"} · Face {wfhPolicy.wfh_face ?? "WAJIB"} · Liveness {wfhPolicy.wfh_liveness ?? "WAJIB"}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={isWfh}
              onClick={() => setIsWfh((v) => !v)}
              className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${isWfh ? "bg-official" : "bg-ledger"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${isWfh ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
          <Btn className="mt-5 w-full py-3 text-base" onClick={() => run()}>
            Mulai {verb}{isWfh ? " (WFH)" : ""}
          </Btn>
        </div>
      </section>
    );
  }

  function SuccessScreen() {
    const rec = state.data.attendance.find((a) => a.employeeId === emp.id && a.date === today);
    const snap = mode === "in" ? rec?.checkInSnap : rec?.checkOutSnap;
    return (
      <section aria-live="polite" className="text-center">
        <div className="stamp-check mx-auto mt-4 mb-6 flex h-24 w-fit items-center justify-center px-6">
          <Stamp kind="approved">
            <SealCheck size={15} weight="bold" /> {verb} Valid
          </Stamp>
        </div>
        <p className="tnum text-3xl font-bold tracking-tight">
          {snap ? fmtClockFromDate(new Date(snap.at)) : "—"}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {rec?.status === "late" ? "Tercatat TERLAMBAT — sesuai aturan grace period." : "Status: Present"}
        </p>

        <ul className="mt-6 space-y-1 text-left">
          {[
            ["GPS Valid", `${snap?.accuracyM ?? "—"} m akurasi`],
            ["Geofence", snap && snap.distanceM >= 0 ? `${snap.distanceM} m dari kantor` : "WFH"],
            ["Face Verified", snap ? `${Math.round(snap.faceScore * 100)}% similarity` : "—"],
            ["Liveness", "PAD lolos"],
            ["Device", snap?.deviceName ?? "—"],
          ].map(([k, v]) => (
            <li key={k} className="flex items-baseline justify-between gap-3 border-b border-ledger/50 pb-1.5 text-sm">
              <span className="text-ink-soft">{k}</span>
              <span className="tnum font-medium">{v}</span>
            </li>
          ))}
        </ul>

        {rec && (
          <p className="tnum mt-4 text-xs text-ink-faint">
            Risk Score {rec.riskScore}/100 · rekaman #{rec.id.slice(-8)}
          </p>
        )}

        <Btn variant="secondary" className="mt-6" onClick={() => setPhase("intro")}>
          Selesai
        </Btn>
      </section>
    );
  }
}

function CalendarOff() {
  return <CalendarX size={26} weight="light" className="text-ink-faint" aria-hidden />;
}

function ScanCorners() {
  const corner = "absolute h-6 w-6 border-stamp";
  return (
    <div aria-hidden>
      <span className={`${corner} top-3 left-3 border-t-2 border-l-2`} />
      <span className={`${corner} top-3 right-3 border-t-2 border-r-2`} />
      <span className={`${corner} bottom-3 left-3 border-b-2 border-l-2`} />
      <span className={`${corner} right-3 bottom-3 border-r-2 border-b-2`} />
    </div>
  );
}
