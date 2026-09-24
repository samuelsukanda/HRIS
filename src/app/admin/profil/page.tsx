"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, DeviceMobile } from "@phosphor-icons/react";
import { Avatar, Btn, Field, Input, PageHead } from "@/components/ui";
import { toastErr, toastOk } from "@/lib/swal";
import { currentUser, useHris } from "@/lib/store";

export default function AdminProfile() {
  const { state, dispatch } = useHris();
  const me = currentUser(state);
  const [thisDeviceId, setThisDeviceId] = useState<string | null>(null);
  const deviceDate = useMemo(() => new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short" }), []);

  useEffect(() => {
    try {
      const k = "hris-device-id";
      let id = sessionStorage.getItem(k);
      if (!id) {
        id = "DEV-" + Math.floor(1000 + Math.random() * 9000);
        sessionStorage.setItem(k, id);
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- baca sessionStorage sekali setelah mount
      setThisDeviceId(id);
    } catch {
      setThisDeviceId("DEV-0000");
    }
  }, []);

  if (!me) return null;
  const { employee, user } = me;
  const dept = state.data.departments.find((d) => d.id === employee.departmentId);
  const pos = state.data.positions.find((p) => p.id === employee.positionId);

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

  async function uploadPhoto(file?: File) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toastErr("Ukuran foto maksimal 2 MB.");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "photo");
    try {
      const r = await fetch("/api/uploads", { method: "POST", body: fd });
      const j = await r.json() as { ok: boolean; url?: string; error?: string };
      if (!j.ok || !j.url) {
        toastErr(j.error ?? "Upload foto gagal.");
        return;
      }
      dispatch({ type: "UPDATE_SELF_PHOTO", employeeId: employee.id, photoUrl: j.url });
      toastOk("Foto profil diperbarui");
    } catch {
      toastErr("Upload foto gagal. Coba lagi.");
    }
  }

  return (
    <>
      <PageHead title="Profil" sub="Kelola foto profil, password, dan perangkat tertaut akun Anda." />

      <section className="mb-5 flex items-center gap-4 border border-rule bg-card p-4">
        <div className="relative shrink-0">
          <Avatar name={employee.name} src={employee.photoUrl} size={64} />
          <label
            title="Ganti foto profil"
            className="btn-press absolute -right-1.5 -bottom-1.5 cursor-pointer rounded-full border border-rule bg-card p-1.5 text-ink-soft hover:border-ink-faint hover:text-ink"
          >
            <Camera size={14} weight="bold" />
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              className="sr-only"
              onChange={(e) => void uploadPhoto(e.target.files?.[0])}
            />
          </label>
        </div>
        <div className="min-w-0">
          <p className="truncate font-bold">{employee.name}</p>
          <p className="tnum text-xs text-ink-faint">{employee.id}</p>
          <p className="mt-1 text-xs text-ink-soft">
            {pos?.title} — {dept?.name}
          </p>
          <p className="font-mono mt-1 text-[10px] tracking-wide text-ink-faint uppercase">{user.role.replace("_", " ")}</p>
        </div>
      </section>

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

      <AdminPasswordChange />
    </>
  );
}

function AdminPasswordChange() {
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  async function submit() {
    setMsg(null);
    const r = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: cur, newPassword: nw }),
    });
    const j = await r.json().catch(() => ({}));
    setMsg(j.ok ? "Password berhasil diganti." : (j.error ?? "Gagal."));
    if (j.ok) {
      setCur("");
      setNw("");
    }
  }
  return (
    <section className="border border-rule bg-card p-4">
      <h2 className="text-sm font-semibold">Ganti Password</h2>
      <div className="mt-3 space-y-2">
        <Field label="Password Lama">
          <Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} />
        </Field>
        <Field label="Password Baru (min 8)">
          <Input type="password" value={nw} onChange={(e) => setNw(e.target.value)} />
        </Field>
        <Btn onClick={submit} disabled={!cur || nw.length < 8}>
          Simpan Password
        </Btn>
        {msg && <p className="text-xs text-ink-soft">{msg}</p>}
      </div>
    </section>
  );
}