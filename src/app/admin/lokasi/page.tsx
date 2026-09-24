"use client";

import { useMemo, useState } from "react";
import { MapPin, Pencil, Trash } from "@phosphor-icons/react";
import { Btn, IconBtn, PageHead, Stamp } from "@/components/ui";
import { confirmDelete, toastErr, toastOk } from "@/lib/swal";
import LocationMapPicker from "@/components/location-map-picker-dynamic";
import LocationMiniMap from "@/components/location-mini-map-dynamic";
import { useHris } from "@/lib/store";
import type { WorkLocation } from "@/lib/types";

export default function AdminLocations() {
  const { state, dispatch } = useHris();
  const locations = state.data.workLocations;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", branchId:"BR-JKT", latitude:-6.2, longitude:106.8, radiusM:100 });

  return (
    <>
      <PageHead
        title="Lokasi Kerja"
        sub="Kelola lokasi kerja dan radius geofence untuk validasi absensi onsite."
        action={<Btn variant="official" size="sm" onClick={()=> setShowForm(true)}>+ Lokasi</Btn>}
      />
      {showForm && (
        <LocationForm
          branches={state.data.branches}
          form={form}
          onChange={(data) => setForm((current) => ({ ...current, ...data }))}
          onCancel={() => setShowForm(false)}
          onSave={() => {
            if (!form.name.trim() || !validCoordinates(form.latitude, form.longitude) || form.radiusM <= 0) return;
            dispatch({ type:"CREATE_LOCATION", location:{ id:`LOC-${Date.now()}`, name:form.name.trim(), branchId:form.branchId, latitude:form.latitude, longitude:form.longitude, radiusM:form.radiusM, allowedTypes:["onsite"] }});
            setShowForm(false);
            setForm({ name:"", branchId:"BR-JKT", latitude:-6.2, longitude:106.8, radiusM:100 });
            toastOk("Lokasi ditambahkan");
          }}
        />
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {locations.map((loc) => (
          <LocationCard key={loc.id} loc={loc} />
        ))}
      </div>

      <WfhPolicy />
    </>
  );
}

type LocationFormState = {
  name: string;
  branchId: string;
  latitude: number;
  longitude: number;
  radiusM: number;
};

function validCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function LocationForm({
  branches,
  form,
  onChange,
  onCancel,
  onSave,
}: {
  branches: { id: string; name: string }[];
  form: LocationFormState;
  onChange: (data: Partial<LocationFormState>) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const coordinatesValid = validCoordinates(form.latitude, form.longitude);

  return (
    <div className="mb-6 border border-rule bg-card p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)]">
        <div className="grid content-start gap-3 sm:grid-cols-2">
          <label className="text-xs">Nama<input value={form.name} onChange={e=> onChange({ name:e.target.value })} className="mt-1 w-full border border-rule bg-paper px-2 py-1.5 text-sm" /></label>
          <label className="text-xs">Branch<select value={form.branchId} onChange={e=> onChange({ branchId:e.target.value })} className="mt-1 w-full border border-rule bg-paper px-2 py-1.5 text-sm">{branches.map(b=> <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label className="text-xs">Latitude<input type="number" step="0.000001" value={form.latitude} onChange={e=> onChange({ latitude:Number(e.target.value) })} className="mt-1 w-full border border-rule bg-paper px-2 py-1.5 text-sm" /></label>
          <label className="text-xs">Longitude<input type="number" step="0.000001" value={form.longitude} onChange={e=> onChange({ longitude:Number(e.target.value) })} className="mt-1 w-full border border-rule bg-paper px-2 py-1.5 text-sm" /></label>
          <label className="text-xs sm:col-span-2">Radius (m)<input type="number" min="1" value={form.radiusM} onChange={e=> onChange({ radiusM:Number(e.target.value) })} className="mt-1 w-full border border-rule bg-paper px-2 py-1.5 text-sm" /></label>
          {!coordinatesValid && <p className="text-xs text-stamp-deep sm:col-span-2">Masukkan latitude -90 sampai 90 dan longitude -180 sampai 180.</p>}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase">Titik lokasi</p>
          <LocationMapPicker latitude={form.latitude} longitude={form.longitude} radiusM={form.radiusM} onChange={(latitude, longitude) => onChange({ latitude, longitude })} />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Btn onClick={onSave} disabled={!form.name.trim() || !coordinatesValid || form.radiusM <= 0}>Simpan</Btn>
        <Btn variant="ghost" onClick={onCancel}>Batal</Btn>
      </div>
    </div>
  );
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-ledger/60 pb-2 sm:flex-col sm:items-start sm:border-b-0 sm:pb-0">
      <span className="text-xs tracking-wide text-ink-faint uppercase">{label}</span>
      <span className="tnum font-mono text-sm font-semibold">{value}</span>
    </div>
  );
}

const WFH_DEFAULTS = { gps: "TIDAK WAJIB", face: "WAJIB", liveness: "WAJIB" };

function WfhPolicy() {
  const { state } = useHris();
  const [saving, setSaving] = useState(false);
  const policy = {
    gps: state.data.settings.wfh_gps ?? WFH_DEFAULTS.gps,
    face: state.data.settings.wfh_face ?? WFH_DEFAULTS.face,
    liveness: state.data.settings.wfh_liveness ?? WFH_DEFAULTS.liveness,
  };

  async function save(next: typeof policy) {
    setSaving(true);
    const r = await fetch("/api/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wfh_gps: next.gps, wfh_face: next.face, wfh_liveness: next.liveness }),
    });
    setSaving(false);
    if (r.ok) {
      // sinkron optimistis via refresh state
      window.location.reload();
      toastOk("Kebijakan WFH disimpan");
    } else {
      toastErr("Gagal menyimpan kebijakan");
    }
  }

  async function edit() {
    const Swal = (await import("sweetalert2")).default;
    const opts = ["WAJIB", "OPSIONAL", "TIDAK WAJIB"];
    const sel = (id: string, val: string) => `<select id="${id}" style="margin-top:4px;width:100%;border:1px solid #d6d3cb;padding:8px;border-radius:4px;font-size:14px">${opts.map((o) => `<option ${o === val ? "selected" : ""}>${o}</option>`).join("")}</select>`;
    const { value } = await Swal.fire({
      title: "Edit Kebijakan WFH",
      html: `<label style="display:block;text-align:left;font-size:12px">GPS Kantor${sel("wfh-gps", policy.gps)}</label><label style="display:block;text-align:left;font-size:12px;margin-top:8px">Face Verification${sel("wfh-face", policy.face)}</label><label style="display:block;text-align:left;font-size:12px;margin-top:8px">Liveness / PAD${sel("wfh-live", policy.liveness)}</label>`,
      showCancelButton: true, confirmButtonText: "Simpan", cancelButtonText: "Batal",
      confirmButtonColor: "#2b4a6f", background: "#f6f5f0", color: "#1c1917",
      preConfirm: () => ({
        gps: (document.getElementById("wfh-gps") as HTMLSelectElement)?.value ?? policy.gps,
        face: (document.getElementById("wfh-face") as HTMLSelectElement)?.value ?? policy.face,
        liveness: (document.getElementById("wfh-live") as HTMLSelectElement)?.value ?? policy.liveness,
      }),
    });
    if (!value) return;
    await save(value);
  }

  async function reset() {
    if (await confirmDelete("kebijakan WFH")) {
      await save({ ...WFH_DEFAULTS });
      toastOk("Kebijakan direset");
    }
  }

  return (
    <section className="mt-8 border border-rule bg-card">
      <header className="flex items-center justify-between gap-2 border-b border-rule px-5 py-3.5">
        <h2 className="font-semibold">Kebijakan Mode WFH {saving && <span className="text-xs font-normal text-ink-faint">· menyimpan…</span>}</h2>
        <div className="flex gap-1">
          <IconBtn label="Edit kebijakan WFH" icon={Pencil} onClick={() => void edit()} />
          <IconBtn label="Reset kebijakan WFH" icon={Trash} className="hover:text-stamp" onClick={() => void reset()} />
        </div>
      </header>
      <div className="grid gap-4 px-5 py-4 sm:grid-cols-3 text-sm">
        <PolicyRow label="GPS Kantor" value={policy.gps} />
        <PolicyRow label="Face Verification" value={policy.face} />
        <PolicyRow label="Liveness / PAD" value={policy.liveness} />
      </div>
      <footer className="border-t border-rule bg-paper px-5 py-3 text-xs leading-relaxed text-ink-soft">
        Absensi WFH tetap melalui pipeline face &amp; liveness penuh tanpa validasi geofence.
        Lokasi tidak direkam saat WFH.
      </footer>
    </section>
  );
}

function LocationCard({ loc }: { loc: WorkLocation }) {
  const { state, dispatch } = useHris();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ name: loc.name, branchId: loc.branchId, latitude: loc.latitude, longitude: loc.longitude, radiusM: loc.radiusM });

  // Titik contoh check-in hari ini untuk plot
  const { data } = state;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const samples = data.attendance
    .filter((a) => a.date === today && a.checkInSnap && a.checkInSnap.distanceM >= 0)
    .slice(0, 12)
    .map((a) => a.checkInSnap!);

  // Titik check-in hari ini untuk peta real (max 12)
  const points = samples.slice(0, 12).map((s) => {
    const dx = s.longitude - loc.longitude;
    const dy = s.latitude - loc.latitude;
    const dist = Math.hypot(dx * 111320 * Math.cos((loc.latitude * Math.PI) / 180), dy * 111320);
    return { latitude: s.latitude, longitude: s.longitude, inside: dist <= loc.radiusM };
  });

  return (
    <section className="border border-rule bg-card">
      <header className="flex items-start justify-between gap-3 border-b border-rule px-5 py-4">
        <div className="flex-1">
          {edit ? (
            <div className="space-y-2">
              <input value={form.name} onChange={e=> setForm({...form,name:e.target.value})} className="w-full border border-rule bg-paper px-2 py-1 text-sm font-semibold" />
              <select value={form.branchId} onChange={e=> setForm({...form,branchId:e.target.value})} aria-label="Branch" className="w-full border border-rule bg-paper px-2 py-1 text-xs">
                {state.data.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <p className="text-xs text-ink-soft">Geser pin pada peta di bawah untuk mengubah titik lokasi.</p>
            </div>
          ) : (
            <>
              <h3 className="font-semibold">{loc.name}</h3>
              <p className="text-xs text-ink-soft">{data.branches.find((b) => b.id === loc.branchId)?.name}</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Stamp kind="neutral"><MapPin size={11} weight="bold" /> Onsite</Stamp>
          {!edit && <IconBtn label={`Edit ${loc.name}`} icon={Pencil} onClick={()=> { setForm({ name: loc.name, branchId: loc.branchId, latitude: loc.latitude, longitude: loc.longitude, radiusM: loc.radiusM }); setEdit(true); }} />}
          <IconBtn label={`Hapus ${loc.name}`} icon={Trash} onClick={async ()=> { if (await confirmDelete(loc.name)) { dispatch({ type:"DELETE_LOCATION", id:loc.id }); toastOk("Lokasi dihapus"); } }} className="hover:text-stamp" />
        </div>
      </header>

      <div className={edit ? "px-5 py-4" : "grid gap-4 px-5 py-4 sm:grid-cols-[1fr_150px]"}>
        <div>
          {edit && (
            <div className="mb-4">
              <LocationMapPicker latitude={form.latitude} longitude={form.longitude} radiusM={form.radiusM} onChange={(latitude, longitude) => setForm((current) => ({ ...current, latitude, longitude }))} />
            </div>
          )}
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-2 border-b border-ledger/50 pb-1.5">
              <dt className="text-xs text-ink-faint uppercase">Latitude</dt>
              <dd className="tnum">{edit ? <input type="number" step="0.000001" value={form.latitude} onChange={(e) => setForm((current) => ({ ...current, latitude: Number(e.target.value) }))} className="w-full border border-rule bg-paper px-2 py-1 text-right text-xs" aria-label="Latitude lokasi" /> : loc.latitude.toFixed(6)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-ledger/50 pb-1.5">
              <dt className="text-xs text-ink-faint uppercase">Longitude</dt>
              <dd className="tnum">{edit ? <input type="number" step="0.000001" value={form.longitude} onChange={(e) => setForm((current) => ({ ...current, longitude: Number(e.target.value) }))} className="w-full border border-rule bg-paper px-2 py-1 text-right text-xs" aria-label="Longitude lokasi" /> : loc.longitude.toFixed(6)}</dd>
            </div>
          </dl>

          <label className="mt-4 block">
            <span className="mb-1 flex items-baseline justify-between text-xs font-semibold tracking-wide text-ink-soft uppercase">
              Radius Geofence
              <span className="tnum font-mono text-sm font-semibold normal-case text-ink">{edit ? form.radiusM : loc.radiusM} m</span>
            </span>
            <input
              type="range"
              min={25}
              max={500}
              step={25}
              value={edit ? form.radiusM : loc.radiusM}
              onChange={(e) => setForm((current) => ({ ...current, radiusM: Number(e.target.value) }))}
              disabled={!edit}
              aria-label={`Radius geofence ${loc.name}`}
              className="w-full accent-[#c03a2c] disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          {edit && (
            <div className="mt-3 flex items-center gap-2">
              <Btn
                disabled={!form.name.trim() || !validCoordinates(form.latitude, form.longitude) || form.radiusM <= 0}
                onClick={() => {
                  const v = validCoordinates(form.latitude, form.longitude);
                  if (!v || form.radiusM < 1) { toastErr("Koordinat atau radius tidak valid"); return; }
                  dispatch({ type: "UPDATE_LOCATION", id: loc.id, data: { name: form.name.trim(), branchId: form.branchId, latitude: form.latitude, longitude: form.longitude, radiusM: form.radiusM } });
                  toastOk("Lokasi diperbarui");
                  setEdit(false);
                }}
                className="px-3 py-1.5 text-xs"
              >
                Simpan Perubahan
              </Btn>
              <Btn variant="ghost" onClick={() => { setForm({ name: loc.name, branchId: loc.branchId, latitude: loc.latitude, longitude: loc.longitude, radiusM: loc.radiusM }); setEdit(false); }} className="px-2 py-1.5 text-xs">
                Batal
              </Btn>
            </div>
          )}
        </div>

        {/* Peta real sebaran check-in */}
        {!edit && (
          <div className="mx-auto w-full max-w-[220px]">
            <LocationMiniMap latitude={loc.latitude} longitude={loc.longitude} radiusM={loc.radiusM} points={points} />
          </div>
        )}
      </div>
    </section>
  );
}
