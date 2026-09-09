"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Archive,
  Briefcase,
  CalendarCheck,
  ChartBar,
  CurrencyDollar,
  Fingerprint,
  GraduationCap,
  ListChecks,
  MapPin,
  Megaphone,
  NotePencil,
  Package,
  MagnifyingGlass,
  SignOut,
  SquaresFour,
  Ticket,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { Avatar, Btn } from "@/components/ui";
import { currentUser, useHris } from "@/lib/store";

interface NavItem {
  href: string;
  label: string;
  icon: Icon;
}
interface NavGroup {
  title: string;
  items: NavItem[];
  disabled?: { label: string; note: string }[];
}

const GROUPS: NavGroup[] = [
  {
    title: "Ikhtisar",
    items: [{ href: "/admin", label: "Dashboard", icon: SquaresFour }],
  },
  {
    title: "Organisasi",
    items: [
      { href: "/admin/karyawan", label: "Karyawan", icon: UsersThree },
      { href: "/admin/lokasi", label: "Lokasi Kerja", icon: MapPin },
      { href: "/admin/master", label: "Master Data", icon: SquaresFour },
    ],
  },
  {
    title: "Kehadiran",
    items: [
      { href: "/admin/absensi", label: "Absensi", icon: Fingerprint },
      { href: "/admin/jadwal", label: "Jadwal & Shift", icon: CalendarCheck },
      { href: "/admin/cuti", label: "Cuti", icon: ListChecks },
    ],
  },
  {
    title: "Kompensasi",
    items: [
      { href: "/admin/lembur", label: "Lembur", icon: Briefcase },
      { href: "/admin/payroll", label: "Payroll", icon: CurrencyDollar },
      { href: "/admin/reimbursements", label: "Reimbursement", icon: Ticket },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/admin/rekrutmen", label: "Rekrutmen", icon: UsersThree },
      { href: "/admin/performa", label: "Performa", icon: NotePencil },
      { href: "/admin/pelatihan", label: "Pelatihan", icon: GraduationCap },
      { href: "/admin/aset", label: "Aset", icon: Package },
    ],
  },
  {
    title: "Arsip",
    items: [
      { href: "/admin/laporan", label: "Laporan", icon: ChartBar },
      { href: "/admin/pengumuman", label: "Pengumuman", icon: Megaphone },
      { href: "/admin/audit", label: "Audit Log", icon: Archive },
    ],
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { state } = useHris();
  const me = currentUser(state);
  const router = useRouter();
  const { logout } = useHris();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQ, setCmdQ] = useState("");
  // ponytail: Cmd+K global search — filter karyawan/cuti/lembur in-memory
  useEffect(()=> { const h=(e:KeyboardEvent)=>{ if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){ e.preventDefault(); setCmdOpen(v=>!v); }}; window.addEventListener("keydown",h); return ()=> window.removeEventListener("keydown",h); },[]);

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center gap-2 border-b border-rule px-5 py-5">
        <Fingerprint size={22} weight="duotone" className="text-stamp" />
        <div className="flex-1">
          <p className="text-sm leading-tight font-bold tracking-tight">HRIS</p>
          <p className="font-mono text-[10px] tracking-widest text-ink-faint uppercase">Human Resource</p>
        </div>
        <button onClick={()=> setCmdOpen(true)} aria-label="Cari (Ctrl+K)" title="Cari (Ctrl+K)" className="btn-press inline-flex min-h-9 min-w-9 items-center justify-center rounded border border-rule bg-paper p-2 text-ink-soft hover:text-ink"><MagnifyingGlass size={16} weight="bold" /></button>
      </div>
      {cmdOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 p-4" onClick={()=> setCmdOpen(false)}>
          <div className="w-full max-w-lg overflow-hidden rounded-[12px] border border-rule bg-card shadow-xl" onClick={e=> e.stopPropagation()}>
            <input autoFocus value={cmdQ} onChange={e=> setCmdQ(e.target.value)} placeholder="Cari karyawan, cuti, lembur..." aria-label="Cari global" className="w-full border-b border-ledger/60 bg-paper px-4 py-3 text-sm outline-none placeholder:text-ink-faint focus:border-official" />
            <div className="max-h-72 overflow-auto p-2">
              {(() => {
                const q=cmdQ.toLowerCase().trim();
                if(!q) return <p className="px-3 py-6 text-center text-xs text-ink-faint">Ketik untuk mencari…</p>;
                const emps=state.data.employees.filter(e=> `${e.name} ${e.id}`.toLowerCase().includes(q)).slice(0,5);
                const leaves=state.data.leaveRequests.filter(r=> r.reason.toLowerCase().includes(q)).slice(0,3);
                const ots=state.data.overtimeRequests.filter(r=> r.reason.toLowerCase().includes(q)).slice(0,3);
                const all=[...emps.map(e=> ({label:e.name, sub:e.id, href:"/admin/karyawan"})), ...leaves.map(l=> ({label:`Cuti ${l.id}`, sub:l.reason.slice(0,30), href:"/admin/cuti"})), ...ots.map(o=> ({label:`Lembur ${o.id}`, sub:o.reason.slice(0,30), href:"/admin/lembur"}))];
                if(all.length===0) return <p className="px-3 py-4 text-xs text-ink-faint">Tidak ada hasil</p>;
                return <ul className="space-y-1">{all.map(a=> <li key={a.label}><Link href={a.href} onClick={()=> setCmdOpen(false)} className="flex justify-between rounded px-3 py-2 text-sm hover:bg-black/[0.04]"><span className="font-medium">{a.label}</span><span className="text-xs text-ink-faint">{a.sub}</span></Link></li>)}</ul>;
              })()}
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {GROUPS.map((g) => (
          <div key={g.title} className="mb-5">
            <p className="mb-1 px-2 font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
              {g.title}
            </p>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active =
                  item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                const IconCmp = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`btn-press flex cursor-pointer items-center gap-2.5 rounded-[4px] border border-transparent px-2.5 py-2 text-sm font-medium ${
                        active
                          ? "border-ledger bg-paper font-semibold text-ink"
                          : "text-ink-soft hover:bg-black/[0.03] hover:text-ink"
                      }`}
                    >
                      <IconCmp size={17} weight={active ? "fill" : "regular"} className={active ? "text-stamp" : ""} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

      </nav>

      <div className="border-t border-rule p-4">
        {me && (
          <div className="mb-3 flex items-center gap-2.5">
            <Avatar name={me.employee.name} size={34} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{me.employee.name}</p>
              <p className="font-mono text-[10px] tracking-wide text-ink-faint uppercase">{me.user.role.replace("_", " ")}</p>
            </div>
          </div>
        )}
        <Btn
          variant="secondary"
          className="w-full"
          icon={SignOut}
          onClick={() => {
            void logout().then(() => router.push("/"));
          }}
        >
          Keluar
        </Btn>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { state } = useHris();
  const router = useRouter();

  // jaring pengaman: sesi hilang (logout/kick nonaktifkan) → selalu kembali ke halaman masuk
  useEffect(() => {
    if (!state.session) router.replace("/");
  }, [state.session, router]);

  return (
    <div className="min-h-[100dvh] lg:pl-64">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-rule lg:block">
        <SidebarContent />
      </aside>

      {/* Sidebar mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Tutup menu" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-xl">
            <button
              onClick={() => setOpen(false)}
              aria-label="Tutup"
              className="absolute top-4 right-3 z-10 cursor-pointer rounded-[4px] p-1 text-ink-soft hover:bg-black/5"
            >
              <X size={18} />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      {/* Bar atas mobile */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-rule bg-card px-4 py-3 lg:hidden">
        <button onClick={() => setOpen(true)} className="btn-press inline-flex cursor-pointer items-center justify-center gap-2 rounded-[4px] border border-rule px-2.5 py-1.5 text-sm font-semibold min-h-9">
          Menu
        </button>
        <span className="font-mono text-xs tracking-widest uppercase">HRIS</span>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
