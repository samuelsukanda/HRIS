"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  DeviceMobile,
  EyeSlash,
  SealCheck,
  ShieldCheck,
} from "@phosphor-icons/react";
import { Avatar, Btn, Field, Input, Stamp } from "@/components/ui";
import { toastOk } from "@/lib/swal";
import { detectDescriptor, loadFaceApi } from "@/lib/face";
import { fmtDateShortID } from "@/lib/format";
import { currentUser, useHris } from "@/lib/store";

export default function EmployeeProfile() {
  const { state, dispatch } = useHris();
  const me = currentUser(state);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [regPhase, setRegPhase] = useState<"idle" | "camera" | "processing" | "done" | "denied">("idle");
  const [qualityNote, setQualityNote] = useState("");
  const [faceNote, setFaceNote] = useState("");
  const [insecure, setInsecure] = useState(false);
  const deviceDate = useMemo(() => new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short" }), []);
  const [thisDeviceId, setThisDeviceId] = useState<string | null>(null);
  useEffect(() => {
    try {
      const k = "hris-device-id";
      let id = sessionStorage.getItem(k);
      if (!id) {
        id = "DEV-" + Math.floor(1000 + Math.random() * 9000);
        sessionStorage.setItem(k, id);
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- baca sessionStorage sekali setelah mount (tidak bisa saat render SSR)
      setThisDeviceId(id);
    } catch {
      setThisDeviceId("DEV-0000");
    }
  }, []);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  if (!me) return null;
  const { employee, user } = me;
  const dept = state.data.departments.find((d) => d.id === employee.departmentId);
  const pos = state.data.positions.find((p) => p.id === employee.positionId);
  const loc = state.data.workLocations.find((w) => w.id === employee.workLocationId);
  // kamera aktif bila fase kamera/processing/denied — prioritas di atas status terdaftar
  // agar tombol "Daftar Ulang" benar-benar membuka kamera
  const showCamera = regPhase === "camera" || regPhase === "processing" || regPhase === "denied";
  // perangkat dikenal dari riwayat snapshot absensi (deviceId + nama + terakhir terlihat)
  // nama model HP spesifik = baris data demo seed, bukan login beneran
  const DEMO_DEVICE_NAMES = ["iPhone 13", "Samsung Galaxy S22", "OPPO Reno 8", "Xiaomi Redmi Note 12", "Xiaomi Redmi Note 9 (baru)"];
  const knownDevices = (() => {
    const map = new Map<string, { name: string; last: string }>();
    for (const a of state.data.attendance.filter((x) => x.employeeId === employee.id)) {
      for (const snap of [a.checkInSnap, a.checkOutSnap]) {
        if (!snap?.deviceId || snap.deviceId === "DEV-0000") continue;
        const prev = map.get(snap.deviceId);
        const at = snap.at ?? "";
        if (!prev || at > prev.last) map.set(snap.deviceId, { name: snap.deviceName || "Perangkat", last: at });
      }
    }
    return [...map.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.last.localeCompare(a.last))
      .slice(0, 5);
  })();

  async function openCamera() {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setInsecure(true);
      return;
    }
    setInsecure(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 } },
        audio: false,
      });
      const live = stream.getVideoTracks().some((t) => t.readyState === "live");
      if (!live) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error("no-live-track");
      }
      streamRef.current = stream;
      setRegPhase("camera");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      });
    } catch {
      setRegPhase("denied");
    }
  }

  async function capture() {
    setRegPhase("processing");
    try {
      const video = videoRef.current;
      if (!video) throw new Error("no-video");
      setQualityNote("Memuat model pengenalan wajah…");
      await loadFaceApi();
      const samples: number[][] = [];
      for (let i = 0; i < 3; i++) {
        setQualityNote(`Merekam template ${i + 1}/3…`);
        const det = await detectDescriptor(video);
        if (!det) {
          setQualityNote("");
          streamRef.current?.getTracks().forEach((t) => t.stop());
          setFaceNote("Wajah tidak terdeteksi. Hadap kamera dengan pencahayaan cukup, lalu ulangi.");
          setRegPhase("camera");
          return;
        }
        samples.push(det.descriptor);
        await new Promise((r) => setTimeout(r, 600));
      }
      const avg = samples[0].map((_, i) => samples.reduce((s, x) => s + x[i], 0) / samples.length);
      setQualityNote("Menyimpan template terenkripsi…");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      dispatch({ type: "REGISTER_FACE", employeeId: employee.id, descriptor: avg });
      toastOk("Wajah terdaftar");
      setRegPhase("done");
    } catch {
      setQualityNote("");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setFaceNote("Gagal memproses wajah. Pastikan kamera berfungsi dan coba lagi.");
      setRegPhase("idle");
    }
  }

  return (
    <>
      <h1 className="mb-4 text-xl font-bold tracking-tight">Profil</h1>

      {/* Kartu identitas */}
      <section className="mb-5 flex items-center gap-4 border border-rule bg-card p-4">
        <Avatar name={employee.name} size={64} />
        <div className="min-w-0">
          <p className="truncate font-bold">{employee.name}</p>
              <p className="tnum text-xs text-ink-faint">{employee.id}</p>
          <p className="mt-1 text-xs text-ink-soft">
            {pos?.title} — {dept?.name}
          </p>
          <div className="mt-2">
            {employee.employmentType === "probation" ? <Stamp kind="pending">Probation</Stamp> : <Stamp kind="approved">Permanen</Stamp>}
          </div>
        </div>
      </section>

      {/* Face & biometrik */}
      <section className="mb-5 border border-rule bg-card" aria-label="Pendaftaran wajah">
        <header className="flex items-center gap-2 border-b border-rule px-4 py-2.5">
          <ShieldCheck size={16} weight="duotone" className={employee.faceRegistered ? "text-official" : "text-stamp"} />
          <h2 className="text-sm font-semibold">Verifikasi Wajah</h2>
        </header>
            <div className="px-4 py-4">
              {insecure ? (
                <div className="text-sm">
                  <p className="font-semibold text-stamp-deep">Koneksi tidak aman (HTTP).</p>
                  <p className="mt-1 leading-relaxed text-ink-soft">
                    Browser memblokir kamera karena halaman dibuka via IP HTTP.
                    Buka lewat <b className="text-ink">HTTPS</b> (ganti http:// jadi https:// dan terima peringatan sertifikat),
                    atau lewat localhost bila di laptop yang sama.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Btn variant="secondary" onClick={() => setInsecure(false)}>
                      Kembali
                    </Btn>
                    <Btn variant="ghost" onClick={() => void openCamera()}>
                      Coba Lagi
                    </Btn>
                  </div>
                </div>
              ) : showCamera ? (
            regPhase === "camera" ? (
              <>
                <div className="relative overflow-hidden border border-rule bg-ink">
                  <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full scale-x-[-1] object-cover" />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                  Hadap kamera dengan pencahayaan cukup, lalu tekan tangkap. Sistem merekam 3 sampel.
                </p>
                {faceNote && <p className="mt-2 text-xs text-stamp-deep">{faceNote}</p>}
                <div className="mt-3 flex gap-2">
                  <Btn onClick={capture}>Tangkap Template</Btn>
                  <Btn
                    variant="ghost"
                    onClick={() => {
                      streamRef.current?.getTracks().forEach((t) => t.stop());
                      setRegPhase("idle");
                    }}
                  >
                    Batal
                  </Btn>
                </div>
              </>
            ) : regPhase === "processing" ? (
              <p role="status" className="tnum animate-pulse font-mono text-sm">
                {qualityNote}
              </p>
            ) : (
              <div className="text-sm">
                <p className="font-semibold text-stamp-deep">Kamera tidak dapat diakses.</p>
                <p className="mt-1 text-ink-soft">Berikan izin kamera pada browser, lalu coba lagi.</p>
                <Btn variant="secondary" className="mt-3" onClick={() => setRegPhase("idle")}>
                  Kembali
                </Btn>
              </div>
            )
          ) : employee.faceRegistered || regPhase === "done" ? (
            <div className="flex items-start gap-3">
              <SealCheck size={20} weight="fill" className="mt-0.5 shrink-0 text-official" />
              <div className="text-sm leading-relaxed">
                <p className="font-semibold">Template Wajah Aktif</p>
                <p className="text-ink-soft">
                  Template wajah Anda tersimpan secara terenkripsi dan hanya digunakan untuk
                  verifikasi identitas saat absensi.
                </p>
                <Btn variant="secondary" className="mt-3" onClick={openCamera}>
                  Daftar Ulang
                </Btn>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-ink-soft">
                Wajah Anda belum terdaftar, sehingga tombol absensi terkunci. Pendaftaran memakai
                kamera depan ±20 detik.
              </p>
              <Btn icon={Camera} className="mt-3" onClick={openCamera}>
                Daftarkan Wajah
              </Btn>
            </>
          )}
        </div>
      </section>

      {/* Perangkat */}
      <section className="mb-5 border border-rule bg-card" aria-label="Perangkat terdaftar">
        <header className="flex items-center gap-2 border-b border-rule px-4 py-2.5">
          <DeviceMobile size={16} weight="duotone" className="text-stamp" />
          <h2 className="text-sm font-semibold">Perangkat Terikat</h2>
        </header>
        <ul className="divide-y divide-ledger/60 px-4">
          {knownDevices.length === 0 ? (
            <li className="py-2.5 text-sm text-ink-soft">
              Belum ada perangkat tercatat. Perangkat{thisDeviceId ? ` ini (${thisDeviceId})` : ""} akan tercatat otomatis saat Anda pertama kali absen.
            </li>
          ) : (
            knownDevices.map((d) => {
              const isDemo = DEMO_DEVICE_NAMES.includes(d.name);
              return (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {d.name}
                      {isDemo && <span className="ml-2 rounded bg-ink/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-faint">demo</span>}
                    </span>
                    <span className="tnum block text-xs text-ink-faint">{d.id}</span>
                  </span>
                  <span className="tnum shrink-0 text-right text-xs text-ink-faint">
                    {d.id === thisDeviceId ? "perangkat ini" : `terakhir ${d.last ? new Date(d.last).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : deviceDate}`}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </section>

      {/* Privacy center ringkas */}
      <section className="border border-dashed border-rule bg-transparent p-4" aria-label="Privasi">
        <div className="flex items-start gap-3">
          <EyeSlash size={18} weight="light" className="mt-0.5 shrink-0 text-ink-faint" />
          <div className="text-xs leading-relaxed text-ink-soft">
            <p className="font-semibold text-ink">Data apa yang disimpan tentang saya?</p>
            <p className="mt-1">
              Kami menyimpan lokasi saat absensi, bukan riwayat pergerakan, beserta hasil
              verifikasi wajah dan liveness, waktu absensi, serta informasi perangkat. Setiap
              akses terhadap data tersebut tercatat dalam audit log perusahaan.
            </p>
          </div>
        </div>
      </section>

      <dl className="tnum mt-6 space-y-1.5 border-t border-rule pt-4 text-xs text-ink-faint">
        <Row k="Bergabung" v={fmtDateShortID(employee.joinDate)} />
        <Row k="Lokasi kerja" v={loc?.name ?? "—"} />
        <Row k="Email" v={user.email} />
        <Row k="Telepon" v={employee.phone || "—"} />
        <Row k="Bank" v={employee.bankName ? `${employee.bankName} ${employee.bankAccount}` : "—"} />
        <Row k="Kontak Darurat" v={employee.emergencyContact?.name ? `${employee.emergencyContact.name} (${employee.emergencyContact.relation})` : "—"} />
      </dl>
      <PasswordChange />
    </>
  );
}

function PasswordChange(){
  const [cur,setCur]=useState(""); const [nw,setNw]=useState(""); const [msg,setMsg]=useState<string|null>(null);
  async function submit(){
    setMsg(null);
    const r = await fetch("/api/auth/change-password",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({currentPassword:cur,newPassword:nw})});
    const j = await r.json().catch(()=> ({}));
    setMsg(j.ok ? "Password berhasil diganti." : (j.error ?? "Gagal."));
    if(j.ok){ setCur(""); setNw(""); }
  }
  return (
    <section className="mt-6 border border-rule bg-card p-4">
      <h2 className="text-sm font-semibold">Ganti Password</h2>
      <div className="mt-3 space-y-2">
        <Field label="Password Lama"><Input type="password" value={cur} onChange={e=> setCur(e.target.value)} /></Field>
        <Field label="Password Baru (min 8)"><Input type="password" value={nw} onChange={e=> setNw(e.target.value)} /></Field>
        <Btn onClick={submit} disabled={!cur||nw.length<8}>Simpan Password</Btn>
        {msg && <p className="text-xs text-ink-soft">{msg}</p>}
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{k}</dt>
      <dd className="truncate text-right">{v}</dd>
    </div>
  );
}
