"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  DeviceMobile,
  EyeSlash,
  Pencil,
  SealCheck,
  ShieldCheck,
} from "@phosphor-icons/react";
import { Avatar, Btn, Field, Input, Select, Stamp } from "@/components/ui";
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
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState({ phone: "", address: "", bankName: "", bankAccount: "", emergencyName: "", emergencyRelation: "", emergencyPhone: "" });
  const deviceDate = useMemo(() => new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short" }), []);

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

  function startEdit() {
    setEditFields({
      phone: employee.phone || "",
      address: employee.address || "",
      bankName: employee.bankName || "",
      bankAccount: employee.bankAccount || "",
      emergencyName: employee.emergencyContact?.name || "",
      emergencyRelation: employee.emergencyContact?.relation || "",
      emergencyPhone: employee.emergencyContact?.phone || "",
    });
    setEditMode(true);
  }

  function saveEdit() {
    dispatch({
      type: "UPDATE_PROFILE",
      employeeId: employee.id,
      data: {
        phone: editFields.phone,
        address: editFields.address,
        bankName: editFields.bankName,
        bankAccount: editFields.bankAccount,
        emergencyContact: { name: editFields.emergencyName, relation: editFields.emergencyRelation, phone: editFields.emergencyPhone },
      },
    });
    setEditMode(false);
  }

  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 } },
        audio: false,
      });
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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Profil</h1>
        {!editMode && (
          <Btn variant="secondary" icon={Pencil} onClick={startEdit}>Edit</Btn>
        )}
      </div>

      {editMode ? (
        <section className="mb-5 border border-rule bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Edit Profil</h2>
          <div className="space-y-3">
            <Field label="Telepon">
              <Input value={editFields.phone} onChange={(e) => setEditFields({ ...editFields, phone: e.target.value })} />
            </Field>
            <Field label="Alamat">
              <Input value={editFields.address} onChange={(e) => setEditFields({ ...editFields, address: e.target.value })} />
            </Field>
            <Field label="Bank">
              <Select value={editFields.bankName} onChange={(e) => setEditFields({ ...editFields, bankName: e.target.value })}>
                <option value="">— Pilih Bank —</option>
                <option value="BCA">BCA</option>
                <option value="Mandiri">Mandiri</option>
                <option value="BRI">BRI</option>
                <option value="BNI">BNI</option>
                <option value="CIMB">CIMB Niaga</option>
                <option value="BTN">BTN</option>
                <option value="Danamon">Danamon</option>
              </Select>
            </Field>
            <Field label="No. Rekening">
              <Input value={editFields.bankAccount} onChange={(e) => setEditFields({ ...editFields, bankAccount: e.target.value })} />
            </Field>
            <hr className="border-rule" />
            <p className="text-xs font-semibold text-ink-soft">Kontak Darurat</p>
            <Field label="Nama">
              <Input value={editFields.emergencyName} onChange={(e) => setEditFields({ ...editFields, emergencyName: e.target.value })} />
            </Field>
            <Field label="Hubungan">
              <Select value={editFields.emergencyRelation} onChange={(e) => setEditFields({ ...editFields, emergencyRelation: e.target.value })}>
                <option value="">— Pilih —</option>
                <option value="Suami">Suami</option>
                <option value="Istri">Istri</option>
                <option value="Orang Tua">Orang Tua</option>
                <option value="Saudara">Saudara</option>
                <option value="Lainnya">Lainnya</option>
              </Select>
            </Field>
            <Field label="No. HP">
              <Input value={editFields.emergencyPhone} onChange={(e) => setEditFields({ ...editFields, emergencyPhone: e.target.value })} />
            </Field>
            <div className="flex gap-2">
              <Btn onClick={saveEdit}>Simpan</Btn>
              <Btn variant="ghost" onClick={() => setEditMode(false)}>Batal</Btn>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* Kartu identitas */}
          <section className="mb-5 flex items-center gap-4 border border-rule bg-card p-4">
            <Avatar name={employee.name} size={64} />
            <div className="min-w-0">
              <p className="truncate font-bold">{employee.name}</p>
              <p className="tnum text-xs text-ink-faint">{employee.id} · NIK {employee.nik.slice(0, 8)}••••</p>
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
              {employee.faceRegistered || regPhase === "done" ? (
                <div className="flex items-start gap-3">
                  <SealCheck size={20} weight="fill" className="mt-0.5 shrink-0 text-official" />
                  <div className="text-sm leading-relaxed">
                    <p className="font-semibold">Template wajah aktif</p>
                    <p className="text-ink-soft">
                      Tersimpan sebagai template terenkripsi — bukan foto mentah — dan hanya dipakai untuk
                      verifikasi absensi 1:1.
                    </p>
                    <Btn variant="secondary" className="mt-3" onClick={openCamera}>
                      Daftar Ulang
                    </Btn>
                  </div>
                </div>
              ) : regPhase === "idle" ? (
                <>
                  <p className="text-sm leading-relaxed text-ink-soft">
                    Wajah Anda belum terdaftar, sehingga tombol absensi terkunci. Pendaftaran memakai
                    kamera depan ±20 detik.
                  </p>
                  <Btn icon={Camera} className="mt-3" onClick={openCamera}>
                    Daftarkan Wajah
                  </Btn>
                </>
              ) : regPhase === "camera" ? (
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
              ) : regPhase === "denied" ? (
                <div className="text-sm">
                  <p className="font-semibold text-stamp-deep">Kamera tidak dapat diakses.</p>
                  <p className="mt-1 text-ink-soft">Berikan izin kamera pada browser, lalu coba lagi.</p>
                  <Btn variant="secondary" className="mt-3" onClick={() => setRegPhase("idle")}>
                    Kembali
                  </Btn>
                </div>
              ) : null}
            </div>
          </section>

          {/* Perangkat */}
          <section className="mb-5 border border-rule bg-card" aria-label="Perangkat terdaftar">
            <header className="flex items-center gap-2 border-b border-rule px-4 py-2.5">
              <DeviceMobile size={16} weight="duotone" className="text-stamp" />
              <h2 className="text-sm font-semibold">Perangkat Terikat</h2>
            </header>
            <ul className="divide-y divide-ledger/60 px-4">
              <li className="flex items-center justify-between py-2.5 text-sm">
                <span>Peramban ini</span>
                <span className="tnum text-xs text-ink-faint">
                  {deviceDate} · aktif
                </span>
              </li>
              <li className="py-2.5 text-xs leading-relaxed text-ink-faint">
                Maksimum 2 perangkat per karyawan. Perangkat baru memerlukan verifikasi OTP dan
                persetujuan sesuai kebijakan.
              </li>
            </ul>
          </section>

          {/* Privacy center ringkas */}
          <section className="border border-dashed border-rule bg-transparent p-4" aria-label="Privasi">
            <div className="flex items-start gap-3">
              <EyeSlash size={18} weight="light" className="mt-0.5 shrink-0 text-ink-faint" />
              <div className="text-xs leading-relaxed text-ink-soft">
                <p className="font-semibold text-ink">Data apa yang disimpan tentang saya?</p>
                <p className="mt-1">
                  Titik lokasi satu kali saat absensi (bukan jalur pergerakan), skor verifikasi wajah &
                  liveness, waktu absensi, dan informasi perangkat. Semua akses terhadap data tersebut
                  tercatat di audit log perusahaan.
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
      )}
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
