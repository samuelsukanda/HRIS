"use client";
import { useState } from "react";
import { useHris } from "@/lib/store";
import { Btn, PageHead } from "@/components/ui";

export default function MasterPage(){
  const {state, showToast}=useHris();
  const [tab,setTab]=useState<"branch"|"dept"|"pos"|"leave">("branch");
  const [name,setName]=useState(""); const [city,setCity]=useState(""); const [branchId,setBranchId]=useState(state.data.branches[0]?.id??""); const [title,setTitle]=useState(""); const [level,setLevel]=useState("staff"); const [days,setDays]=useState(12);
  async function createBranch(){ if(!name||!city) return; const r=await fetch("/api/branches",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name,city})}); const j=await r.json(); if(j.ok){ showToast("Branch dibuat","success"); location.reload(); } else showToast(j.error??"Gagal","error"); }
  async function createDept(){ if(!name) return; const r=await fetch("/api/departments",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name,branch_id:branchId})}); const j=await r.json(); if(j.ok){ showToast("Department dibuat","success"); location.reload(); } else showToast(j.error??"Gagal","error"); }
  async function createPos(){ if(!title) return; const r=await fetch("/api/positions",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({title,level})}); const j=await r.json(); if(j.ok){ showToast("Position dibuat","success"); location.reload(); } else showToast(j.error??"Gagal","error"); }
  async function createLeave(){ if(!name) return; const r=await fetch("/api/leave-types",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name,allocation_days:days,paid:true,requires_attachment:false})}); const j=await r.json(); if(j.ok){ showToast("Leave type dibuat","success"); location.reload(); } else showToast(j.error??"Gagal","error"); }
  return <>
    <PageHead title="Master Data" sub="Kelola cabang, departemen, jabatan, dan jenis cuti." />
    <div className="mb-4 flex gap-2">
      {["branch","dept","pos","leave"].map(t=> <button key={t} onClick={()=> setTab(t as any)} className={`px-3 py-1.5 text-xs font-semibold border ${tab===t?"bg-ink text-white":"bg-card"}`}>{t}</button>)}
    </div>
    {tab==="branch" && (
      <section className="border border-rule bg-card p-4">
        <h3 className="font-semibold mb-3">Cabang</h3>
        <ul className="mb-4 divide-y divide-ledger/40 text-sm">{state.data.branches.map(b=> <li key={b.id} className="py-1 flex justify-between"><span>{b.name} — {b.city}</span><span className="flex gap-2"><button onClick={async()=>{ const n=prompt("Nama",b.name)??b.name; const c=prompt("Kota",b.city)??b.city; const r=await fetch(`/api/branches/${b.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:n,city:c})}); if((await r.json()).ok) location.reload(); }} className="text-official">Edit</button><button onClick={async()=>{ if(!confirm(`Hapus ${b.name}?`)) return; const r=await fetch(`/api/branches/${b.id}`,{method:"DELETE"}); if((await r.json()).ok) location.reload(); }} className="text-stamp">Hapus</button></span></li>)}</ul>
        <div className="flex gap-2"><input value={name} onChange={e=> setName(e.target.value)} placeholder="Nama cabang" className="border border-rule bg-paper px-2 py-1 text-sm" /><input value={city} onChange={e=> setCity(e.target.value)} placeholder="Kota" className="border border-rule bg-paper px-2 py-1 text-sm" /><Btn onClick={createBranch}>+ Branch</Btn></div>
      </section>
    )}
    {tab==="dept" && (
      <section className="border border-rule bg-card p-4">
        <h3 className="font-semibold mb-3">Departemen</h3>
        <ul className="mb-4 divide-y divide-ledger/40 text-sm">{state.data.departments.map(d=> <li key={d.id} className="py-1 flex justify-between"><span>{d.name} — {state.data.branches.find(b=> b.id===d.branchId)?.name}</span><span className="flex gap-2"><button onClick={async()=>{ const n=prompt("Nama",d.name)??d.name; const r=await fetch(`/api/departments/${d.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:n})}); if((await r.json()).ok) location.reload(); }} className="text-official">Edit</button><button onClick={async()=>{ if(!confirm(`Hapus ${d.name}?`)) return; const r=await fetch(`/api/departments/${d.id}`,{method:"DELETE"}); if((await r.json()).ok) location.reload(); }} className="text-stamp">Hapus</button></span></li>)}</ul>
        <div className="flex gap-2"><input value={name} onChange={e=> setName(e.target.value)} placeholder="Nama departemen" className="border border-rule bg-paper px-2 py-1 text-sm" /><select value={branchId} onChange={e=> setBranchId(e.target.value)} className="border border-rule bg-paper px-2 py-1 text-sm">{state.data.branches.map(b=> <option key={b.id} value={b.id}>{b.name}</option>)}</select><Btn onClick={createDept}>+ Dept</Btn></div>
      </section>
    )}
    {tab==="pos" && (
      <section className="border border-rule bg-card p-4">
        <h3 className="font-semibold mb-3">Jabatan</h3>
        <ul className="mb-4 divide-y divide-ledger/40 text-sm">{state.data.positions.map(p=> <li key={p.id} className="py-1 flex justify-between"><span>{p.title} — {p.level}</span><span className="flex gap-2"><button onClick={async()=>{ const n=prompt("Title",p.title)??p.title; const l=prompt("Level",p.level)??p.level; const r=await fetch(`/api/positions/${p.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:n,level:l})}); if((await r.json()).ok) location.reload(); }} className="text-official">Edit</button><button onClick={async()=>{ if(!confirm(`Hapus ${p.title}?`)) return; const r=await fetch(`/api/positions/${p.id}`,{method:"DELETE"}); if((await r.json()).ok) location.reload(); }} className="text-stamp">Hapus</button></span></li>)}</ul>
        <div className="flex gap-2"><input value={title} onChange={e=> setTitle(e.target.value)} placeholder="Title" className="border border-rule bg-paper px-2 py-1 text-sm" /><input value={level} onChange={e=> setLevel(e.target.value)} placeholder="level" className="border border-rule bg-paper px-2 py-1 text-sm" /><Btn onClick={createPos}>+ Position</Btn></div>
      </section>
    )}
    {tab==="leave" && (
      <section className="border border-rule bg-card p-4">
        <h3 className="font-semibold mb-3">Jenis Cuti</h3>
        <ul className="mb-4 divide-y divide-ledger/40 text-sm">{state.data.leaveTypes.map(t=> <li key={t.id} className="py-1 flex justify-between"><span>{t.name} — {t.allocationDays} hari</span><span className="flex gap-2"><button onClick={async()=>{ const n=prompt("Nama",t.name)??t.name; const d=Number(prompt("Alokasi",String(t.allocationDays))??t.allocationDays); const r=await fetch(`/api/leave-types/${t.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:n,allocation_days:d})}); if((await r.json()).ok) location.reload(); }} className="text-official">Edit</button><button onClick={async()=>{ if(!confirm(`Hapus ${t.name}?`)) return; const r=await fetch(`/api/leave-types/${t.id}`,{method:"DELETE"}); if((await r.json()).ok) location.reload(); }} className="text-stamp">Hapus</button></span></li>)}</ul>
        <div className="flex gap-2"><input value={name} onChange={e=> setName(e.target.value)} placeholder="Nama cuti" className="border border-rule bg-paper px-2 py-1 text-sm" /><input type="number" value={days} onChange={e=> setDays(Number(e.target.value))} className="border border-rule bg-paper px-2 py-1 text-sm w-20" /><Btn onClick={createLeave}>+ Leave Type</Btn></div>
      </section>
    )}
  </>
}
