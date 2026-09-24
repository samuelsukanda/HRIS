"use client";
import { useState, useSyncExternalStore } from "react";
import { Pencil, Trash } from "@phosphor-icons/react";
import { useHris } from "@/lib/store";
import { confirmDelete, formModal, toastErr, toastOk } from "@/lib/swal";
import { fmtRupiah } from "@/lib/format";
import { Btn, IconBtn, PageHead } from "@/components/ui";

async function handleApi(r: Response): Promise<boolean> {
  const j = await r.json().catch(() => null) as { ok?: boolean; error?: string } | null;
  if (j?.ok) return true;
  toastErr(j?.error ?? `Terjadi kesalahan server (${r.status}).`);
  return false;
}
async function patch(url: string, body: unknown) {
  const r = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return handleApi(r);
}
async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return handleApi(r);
}
async function del(url: string) {
  const r = await fetch(url, { method: "DELETE" });
  return handleApi(r);
}
function saved(msg: string) {
  toastOk(msg);
  setTimeout(() => location.reload(), 650);
}

const MASTER_TAB_KEYS = ["branch", "dept", "pos", "leave", "bank", "window", "payroll"] as const;
type MasterTab = (typeof MASTER_TAB_KEYS)[number];

// Tab aktif disimpan di URL hash agar tetap terjaga setelah saved() me-reload halaman.
let masterTabListeners: (() => void)[] = [];
function subscribeMasterTab(cb: () => void) {
  const onHash = () => cb();
  window.addEventListener("hashchange", onHash);
  masterTabListeners.push(cb);
  return () => {
    window.removeEventListener("hashchange", onHash);
    masterTabListeners = masterTabListeners.filter((l) => l !== cb);
  };
}
function currentMasterTab(): MasterTab {
  const h = window.location.hash.replace("#", "") as MasterTab;
  return MASTER_TAB_KEYS.includes(h) ? h : "branch";
}

export default function MasterPage(){
  const {state}=useHris();
  const tab = useSyncExternalStore(subscribeMasterTab, currentMasterTab, () => "branch" as MasterTab);
  const [name,setName]=useState(""); const [city,setCity]=useState(""); const [branchId,setBranchId]=useState(state.data.branches[0]?.id??""); const [title,setTitle]=useState(""); const [level,setLevel]=useState("staff"); const [days,setDays]=useState(12);

  function changeTab(key: MasterTab) {
    window.history.replaceState(null, "", `#${key}`);
    for (const l of masterTabListeners) l();
    setMq("");
  }

  async function createBranch(){ if(!name.trim()||!city.trim()) return; if(await post("/api/branches",{name:name.trim(),city:city.trim()})) saved("Cabang ditambahkan"); }
  async function createDept(){ if(!name.trim()) return; if(await post("/api/departments",{name:name.trim(),branch_id:branchId})) saved("Departemen ditambahkan"); }
  async function createPos(){ if(!title.trim()) return; if(await post("/api/positions",{title:title.trim(),level})) saved("Jabatan ditambahkan"); }
  async function createLeave(){ if(!name.trim()) return; if(await post("/api/leave-types",{name:name.trim(),allocation_days:days,paid:true,requires_attachment:false})) saved("Jenis cuti ditambahkan"); }
  async function createBank(){ if(!name.trim()) return; if(await post("/api/banks",{name:name.trim()})) saved("Bank ditambahkan"); }

  const tabs = [
    { key:"branch", label:"Cabang" },
    { key:"dept", label:"Departemen" },
    { key:"pos", label:"Jabatan" },
    { key:"leave", label:"Jenis Cuti" },
    { key:"bank", label:"Bank" },
    { key:"window", label:"Window Check-in" },
    { key:"payroll", label:"Payroll" },
  ] as const;
  const [mq, setMq] = useState("");
  const mqNeedle = mq.trim().toLowerCase();
  const matchMq = (s: string) => !mqNeedle || s.toLowerCase().includes(mqNeedle);
  return <>
    <PageHead title="Master Data" sub="Kelola data cabang, departemen, jabatan, jenis cuti, bank, dan window check-in." />
    <div className="mb-4 flex gap-2">
      {tabs.map(t=> <button key={t.key} onClick={()=> changeTab(t.key)} className={`min-h-9 px-3 py-1.5 text-xs font-semibold border ${tab===t.key?"bg-ink text-white":"bg-card"}`}>{t.label}</button>)}
    </div>
    {tab !== "window" && tab !== "payroll" && (
      <div className="mb-4 max-w-md">
        <input value={mq} onChange={(e) => setMq(e.target.value)} placeholder="Cari di tab ini…" aria-label="Cari master data" className="min-h-9 w-full border border-rule bg-card px-3 py-1.5 text-sm outline-none placeholder:text-ink-faint focus:border-official" />
      </div>
    )}
    {tab==="branch" && (
      <section className="border border-rule bg-card p-4">
        <div className="mb-4 flex flex-wrap gap-2 border-b border-ledger/40 pb-4">
          <input value={name} onChange={e=> setName(e.target.value)} placeholder="Nama cabang" aria-label="Nama cabang" className="min-h-9 flex-1 min-w-40 border border-rule bg-paper px-2 py-1 text-sm" />
          <input value={city} onChange={e=> setCity(e.target.value)} placeholder="Kota" aria-label="Kota" className="min-h-9 w-36 border border-rule bg-paper px-2 py-1 text-sm" />
          <Btn size="sm" onClick={createBranch} disabled={!name.trim()||!city.trim()}>+ Cabang</Btn>
        </div>
        <ul className="divide-y divide-ledger/40 text-sm">{state.data.branches.filter((b) => matchMq(`${b.name} ${b.city}`)).map(b=> <li key={b.id} className="py-2 flex items-center justify-between gap-2"><span className="font-medium">{b.name} <span className="font-normal text-ink-faint">— {b.city}</span></span><span className="flex gap-1"><IconBtn label={`Edit ${b.name}`} icon={Pencil} onClick={async()=>{ const v=await formModal<{name:string;city:string}>("Edit Cabang",[{key:"name",label:"Nama",value:b.name},{key:"city",label:"Kota",value:b.city}]); if(!v||!v.name.trim()) return; if(await patch(`/api/branches/${b.id}`,{name:v.name.trim(),city:v.city.trim()})) saved("Cabang disimpan"); }} /><IconBtn label={`Hapus ${b.name}`} icon={Trash} className="hover:text-stamp" onClick={async()=>{ if(await confirmDelete(b.name) && await del(`/api/branches/${b.id}`)) saved("Cabang dihapus"); }} /></span></li>)}</ul>
      </section>
    )}
    {tab==="dept" && (
      <section className="border border-rule bg-card p-4">
        <div className="mb-4 flex flex-wrap gap-2 border-b border-ledger/40 pb-4">
          <input value={name} onChange={e=> setName(e.target.value)} placeholder="Nama departemen" aria-label="Nama departemen" className="min-h-9 flex-1 min-w-40 border border-rule bg-paper px-2 py-1 text-sm" />
          <select value={branchId} onChange={e=> setBranchId(e.target.value)} aria-label="Cabang" className="min-h-9 border border-rule bg-paper px-2 py-1 text-sm">{state.data.branches.map(b=> <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <Btn size="sm" onClick={createDept} disabled={!name.trim()}>+ Departemen</Btn>
        </div>
        <ul className="divide-y divide-ledger/40 text-sm">{state.data.departments.filter((d) => matchMq(d.name)).map(d=> <li key={d.id} className="py-2 flex items-center justify-between gap-2"><span className="font-medium">{d.name} <span className="font-normal text-ink-faint">— {state.data.branches.find(b=> b.id===d.branchId)?.name}</span></span><span className="flex gap-1"><IconBtn label={`Edit ${d.name}`} icon={Pencil} onClick={async()=>{ const v=await formModal<{name:string;branch_id:string}>("Edit Departemen",[{key:"name",label:"Nama",value:d.name},{key:"branch_id",label:"Cabang",value:d.branchId,options:state.data.branches.map(b=> ({value:b.id,label:b.name}))}]); if(!v||!v.name.trim()) return; if(await patch(`/api/departments/${d.id}`,{name:v.name.trim(),branch_id:v.branch_id})) saved("Departemen disimpan"); }} /><IconBtn label={`Hapus ${d.name}`} icon={Trash} className="hover:text-stamp" onClick={async()=>{ if(await confirmDelete(d.name) && await del(`/api/departments/${d.id}`)) saved("Departemen dihapus"); }} /></span></li>)}</ul>
      </section>
    )}
    {tab==="pos" && (
      <section className="border border-rule bg-card p-4">
        <div className="mb-4 flex flex-wrap gap-2 border-b border-ledger/40 pb-4">
          <input value={title} onChange={e=> setTitle(e.target.value)} placeholder="Nama jabatan" aria-label="Nama jabatan" className="min-h-9 flex-1 min-w-40 border border-rule bg-paper px-2 py-1 text-sm" />
          <input value={level} onChange={e=> setLevel(e.target.value)} placeholder="Level" aria-label="Level" className="min-h-9 w-28 border border-rule bg-paper px-2 py-1 text-sm" />
          <Btn size="sm" onClick={createPos} disabled={!title.trim()}>+ Jabatan</Btn>
        </div>
        <ul className="divide-y divide-ledger/40 text-sm">{state.data.positions.filter((p) => matchMq(`${p.title} ${p.level}`)).map(p=> <li key={p.id} className="py-2 flex items-center justify-between gap-2"><span className="font-medium">{p.title} <span className="font-normal text-ink-faint">— {p.level}</span></span><span className="flex gap-1"><IconBtn label={`Edit ${p.title}`} icon={Pencil} onClick={async()=>{ const v=await formModal<{title:string;level:string}>("Edit Jabatan",[{key:"title",label:"Nama",value:p.title},{key:"level",label:"Level",value:p.level}]); if(!v||!v.title.trim()) return; if(await patch(`/api/positions/${p.id}`,{title:v.title.trim(),level:v.level.trim()})) saved("Jabatan disimpan"); }} /><IconBtn label={`Hapus ${p.title}`} icon={Trash} className="hover:text-stamp" onClick={async()=>{ if(await confirmDelete(p.title) && await del(`/api/positions/${p.id}`)) saved("Jabatan dihapus"); }} /></span></li>)}</ul>
      </section>
    )}
    {tab==="leave" && (
      <section className="border border-rule bg-card p-4">
        <div className="mb-4 flex flex-wrap gap-2 border-b border-ledger/40 pb-4">
          <input value={name} onChange={e=> setName(e.target.value)} placeholder="Nama cuti" aria-label="Nama cuti" className="min-h-9 flex-1 min-w-40 border border-rule bg-paper px-2 py-1 text-sm" />
          <input type="number" value={days} onChange={e=> setDays(Number(e.target.value))} aria-label="Alokasi hari" className="min-h-9 w-24 border border-rule bg-paper px-2 py-1 text-sm" />
          <Btn size="sm" onClick={createLeave} disabled={!name.trim()}>+ Jenis Cuti</Btn>
        </div>
        <ul className="divide-y divide-ledger/40 text-sm">{state.data.leaveTypes.filter((t) => matchMq(t.name)).map(t=> <li key={t.id} className="py-2 flex items-center justify-between gap-2"><span className="font-medium">{t.name} <span className="tnum font-normal text-ink-faint">— {t.allocationDays} hari</span></span><span className="flex gap-1"><IconBtn label={`Edit ${t.name}`} icon={Pencil} onClick={async()=>{ const v=await formModal<{name:string;days:string}>("Edit Jenis Cuti",[{key:"name",label:"Nama",value:t.name},{key:"days",label:"Alokasi (hari)",value:String(t.allocationDays),type:"number"}]); if(!v||!v.name.trim()) return; if(await patch(`/api/leave-types/${t.id}`,{name:v.name.trim(),allocation_days:Number(v.days)})) saved("Jenis cuti disimpan"); }} /><IconBtn label={`Hapus ${t.name}`} icon={Trash} className="hover:text-stamp" onClick={async()=>{ if(await confirmDelete(t.name) && await del(`/api/leave-types/${t.id}`)) saved("Jenis cuti dihapus"); }} /></span></li>)}</ul>
      </section>
    )}
    {tab==="bank" && (
      <section className="border border-rule bg-card p-4">
        <div className="mb-4 flex flex-wrap gap-2 border-b border-ledger/40 pb-4">
          <input value={name} onChange={e=> setName(e.target.value)} placeholder="Nama bank" aria-label="Nama bank" className="min-h-9 flex-1 min-w-40 border border-rule bg-paper px-2 py-1 text-sm" />
          <Btn size="sm" onClick={createBank} disabled={!name.trim()}>+ Bank</Btn>
        </div>
        <ul className="divide-y divide-ledger/40 text-sm">{state.data.banks.filter((b) => matchMq(b.name)).map(b=> <li key={b.id} className="py-2 flex items-center justify-between gap-2"><span className="font-medium">{b.name}</span><span className="flex gap-1"><IconBtn label={`Edit ${b.name}`} icon={Pencil} onClick={async()=>{ const v=await formModal<{name:string}>("Edit Bank",[{key:"name",label:"Nama Bank",value:b.name}]); if(!v||!v.name.trim()) return; if(await patch(`/api/banks/${b.id}`,{name:v.name.trim()})) saved("Bank disimpan"); }} /><IconBtn label={`Hapus ${b.name}`} icon={Trash} className="hover:text-stamp" onClick={async()=>{ if(await confirmDelete(b.name) && await del(`/api/banks/${b.id}`)) saved("Bank dihapus"); }} /></span></li>)}</ul>
      </section>
    )}
    {tab==="window" && (
      <WindowTab />
    )}
    {tab==="payroll" && (
      <PayrollTab />
    )}
  </>
}

function WindowTab() {
  const { state, showToast } = useHris();
  const current = Number(state.data.settings.checkin_window) || 60;
  const [minutes, setMinutes] = useState(current);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 720) {
      showToast("Window 5–720 menit.", "error");
      return;
    }
    setBusy(true);
    const r = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkin_window: String(minutes) }) });
    const j = await r.json().catch(() => ({})) as { ok: boolean; error?: string };
    setBusy(false);
    if (j.ok) saved("Window check-in disimpan");
    else showToast(j.error ?? "Gagal.", "error");
  }
  return (
    <section className="border border-rule bg-card p-4">
      <h3 className="font-semibold">Window Check-in</h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
        Toleransi menit sebelum/sesudah jam mulai shift. Saat ini: <b className="tnum text-ink">±{current} menit</b>. Berlaku untuk check-in berikutnya.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
          Menit
          <input type="number" min={5} max={720} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="tnum mt-1 block min-h-9 w-32 border border-rule bg-paper px-2 py-1 text-sm" />
        </label>
        <Btn size="sm" onClick={() => void save()} disabled={busy || minutes === current}>Simpan</Btn>
      </div>
    </section>
  );
}

function PayrollTab() {
  const { state, showToast } = useHris();
  const s = state.data.settings;
  const curOtMode = s.ot_mode === "flat" ? "flat" : "formula";
  const curAlphaMode = s.alpha_mode === "flat" ? "flat" : "proportional";
  const curOtRate = Number(s.ot_flat_rate) || 0;
  const curAlphaRate = Number(s.alpha_flat_rate) || 0;
  const [otMode, setOtMode] = useState<"formula" | "flat">(curOtMode);
  const [otRate, setOtRate] = useState(curOtRate);
  const [alphaMode, setAlphaMode] = useState<"proportional" | "flat">(curAlphaMode);
  const [alphaRate, setAlphaRate] = useState(curAlphaRate);
  const [busy, setBusy] = useState(false);
  const validRate = (n: number) => Number.isInteger(n) && n >= 0 && n <= 100_000_000;
  const changed = otMode !== curOtMode || otRate !== curOtRate || alphaMode !== curAlphaMode || alphaRate !== curAlphaRate;

  async function save() {
    if (!validRate(otRate) || !validRate(alphaRate)) {
      showToast("Tarif harus angka bulat 0–100.000.000.", "error");
      return;
    }
    setBusy(true);
    const r = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ot_mode: otMode, ot_flat_rate: String(otRate), alpha_mode: alphaMode, alpha_flat_rate: String(alphaRate) }) });
    const j = await r.json().catch(() => ({})) as { ok: boolean; error?: string };
    setBusy(false);
    if (j.ok) saved("Master upah & potongan disimpan");
    else showToast(j.error ?? "Gagal.", "error");
  }

  const inputCls = "tnum mt-1 block min-h-9 w-44 border border-rule bg-paper px-2 py-1 text-sm disabled:opacity-50";
  return (
    <section className="border border-rule bg-card p-4">
      <h3 className="font-semibold">Upah Lembur & Potongan Alpha</h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
        Berlaku untuk perhitungan payroll berikutnya. Saat ini: lembur <b className="text-ink">{curOtMode === "flat" ? `tarif flat ${fmtRupiah(curOtRate)}/jam` : "rumus 1/173 (×1,5 / ×2)"}</b> · potongan alpha <b className="text-ink">{curAlphaMode === "flat" ? `flat ${fmtRupiah(curAlphaRate)}/hari` : "proporsional gaji/hari"}</b>.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Upah Lembur</p>
          <label className="mt-1 block text-xs text-ink-soft">
            Metode
            <select value={otMode} onChange={(e) => setOtMode(e.target.value as "formula" | "flat")} className="mt-1 block min-h-9 w-44 border border-rule bg-paper px-2 py-1 text-sm">
              <option value="formula">Rumus 1/173 (×1,5 / ×2)</option>
              <option value="flat">Tarif flat per jam</option>
            </select>
          </label>
          <label className="mt-2 block text-xs text-ink-soft">
            Tarif per jam (Rp)
            <input type="number" min={0} step={1000} value={otRate} onChange={(e) => setOtRate(Number(e.target.value))} disabled={otMode !== "flat"} className={inputCls} />
          </label>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Potongan Absen Tanpa Cuti</p>
          <label className="mt-1 block text-xs text-ink-soft">
            Metode
            <select value={alphaMode} onChange={(e) => setAlphaMode(e.target.value as "proportional" | "flat")} className="mt-1 block min-h-9 w-44 border border-rule bg-paper px-2 py-1 text-sm">
              <option value="proportional">Proporsional gaji/hari</option>
              <option value="flat">Potongan flat per hari</option>
            </select>
          </label>
          <label className="mt-2 block text-xs text-ink-soft">
            Potongan per hari (Rp)
            <input type="number" min={0} step={1000} value={alphaRate} onChange={(e) => setAlphaRate(Number(e.target.value))} disabled={alphaMode !== "flat"} className={inputCls} />
          </label>
        </div>
      </div>
      <div className="mt-4">
        <Btn size="sm" onClick={() => void save()} disabled={busy || !changed}>Simpan</Btn>
      </div>
    </section>
  );
}
