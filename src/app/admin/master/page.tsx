"use client";
import { useState } from "react";
import { Pencil, Trash } from "@phosphor-icons/react";
import { useHris } from "@/lib/store";
import { confirmDelete, formModal, toastOk } from "@/lib/swal";
import { Btn, IconBtn, PageHead } from "@/components/ui";

async function patch(url: string, body: unknown) {
  const r = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await r.json() as { ok: boolean }).ok;
}
async function del(url: string) {
  const r = await fetch(url, { method: "DELETE" });
  return (await r.json() as { ok: boolean }).ok;
}
function saved(msg: string) {
  toastOk(msg);
  setTimeout(() => location.reload(), 650);
}

export default function MasterPage(){
  const {state, showToast}=useHris();
  const [tab,setTab]=useState<"branch"|"dept"|"pos"|"leave">("branch");
  const [name,setName]=useState(""); const [city,setCity]=useState(""); const [branchId,setBranchId]=useState(state.data.branches[0]?.id??""); const [title,setTitle]=useState(""); const [level,setLevel]=useState("staff"); const [days,setDays]=useState(12);
  async function createBranch(){ if(!name.trim()||!city.trim()) return; const r=await fetch("/api/branches",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name:name.trim(),city:city.trim()})}); const j=await r.json() as {ok:boolean;error?:string}; if(j.ok){ saved("Cabang ditambahkan"); } else showToast(j.error??"Gagal","error"); }
  async function createDept(){ if(!name.trim()) return; const r=await fetch("/api/departments",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name:name.trim(),branch_id:branchId})}); const j=await r.json() as {ok:boolean;error?:string}; if(j.ok){ saved("Departemen ditambahkan"); } else showToast(j.error??"Gagal","error"); }
  async function createPos(){ if(!title.trim()) return; const r=await fetch("/api/positions",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({title:title.trim(),level})}); const j=await r.json() as {ok:boolean;error?:string}; if(j.ok){ saved("Jabatan ditambahkan"); } else showToast(j.error??"Gagal","error"); }
  async function createLeave(){ if(!name.trim()) return; const r=await fetch("/api/leave-types",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name:name.trim(),allocation_days:days,paid:true,requires_attachment:false})}); const j=await r.json() as {ok:boolean;error?:string}; if(j.ok){ saved("Jenis cuti ditambahkan"); } else showToast(j.error??"Gagal","error"); }

  const tabs = [
    { key:"branch", label:"Cabang" },
    { key:"dept", label:"Departemen" },
    { key:"pos", label:"Jabatan" },
    { key:"leave", label:"Jenis Cuti" },
  ] as const;
  const [mq, setMq] = useState("");
  const mqNeedle = mq.trim().toLowerCase();
  const matchMq = (s: string) => !mqNeedle || s.toLowerCase().includes(mqNeedle);
  return <>
    <PageHead title="Master Data" sub="Kelola data cabang, departemen, jabatan, dan jenis cuti." />
    <div className="mb-4 flex gap-2">
      {tabs.map(t=> <button key={t.key} onClick={()=> { setTab(t.key); setMq(""); }} className={`min-h-9 px-3 py-1.5 text-xs font-semibold border ${tab===t.key?"bg-ink text-white":"bg-card"}`}>{t.label}</button>)}
    </div>
    <div className="mb-4 max-w-md">
      <input value={mq} onChange={(e) => setMq(e.target.value)} placeholder="Cari di tab ini…" aria-label="Cari master data" className="min-h-9 w-full border border-rule bg-card px-3 py-1.5 text-sm outline-none placeholder:text-ink-faint focus:border-official" />
    </div>
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
        <ul className="divide-y divide-ledger/40 text-sm">{state.data.departments.filter((d) => matchMq(d.name)).map(d=> <li key={d.id} className="py-2 flex items-center justify-between gap-2"><span className="font-medium">{d.name} <span className="font-normal text-ink-faint">— {state.data.branches.find(b=> b.id===d.branchId)?.name}</span></span><span className="flex gap-1"><IconBtn label={`Edit ${d.name}`} icon={Pencil} onClick={async()=>{ const v=await formModal<{name:string}>("Edit Departemen",[{key:"name",label:"Nama",value:d.name}]); if(!v||!v.name.trim()) return; if(await patch(`/api/departments/${d.id}`,{name:v.name.trim()})) saved("Departemen disimpan"); }} /><IconBtn label={`Hapus ${d.name}`} icon={Trash} className="hover:text-stamp" onClick={async()=>{ if(await confirmDelete(d.name) && await del(`/api/departments/${d.id}`)) saved("Departemen dihapus"); }} /></span></li>)}</ul>
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
  </>
}
