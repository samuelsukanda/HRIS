"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Archive,
  Bell,
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
  Trash,
  UserCircle,
  UserList,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { Avatar, Btn } from "@/components/ui";
import { currentUser, useHris } from "@/lib/store";
import { isHr } from "@/lib/roles";

interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  hrOnly?: boolean;
  saOnly?: boolean;
  hiddenRoles?: string[];
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
      { href: "/admin/karyawan", label: "Karyawan", icon: UsersThree, hiddenRoles: ["manager", "supervisor"] },
      { href: "/admin/akun", label: "Kelola Akun", icon: UserList, hrOnly: true },
      { href: "/admin/lokasi", label: "Lokasi Kerja", icon: MapPin, hiddenRoles: ["manager", "supervisor"] },
      { href: "/admin/master", label: "Master Data", icon: SquaresFour, hiddenRoles: ["manager", "supervisor"] },
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
      { href: "/admin/payroll", label: "Payroll", icon: CurrencyDollar, hrOnly: true },
      { href: "/admin/reimbursements", label: "Reimbursement", icon: Ticket, hrOnly: true },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/admin/rekrutmen", label: "Rekrutmen", icon: UsersThree, hrOnly: true },
      { href: "/admin/performa", label: "Performa", icon: NotePencil, hrOnly: true },
      { href: "/admin/pelatihan", label: "Pelatihan", icon: GraduationCap, hrOnly: true },
      { href: "/admin/aset", label: "Aset", icon: Package, hrOnly: true },
    ],
  },
  {
    title: "Arsip",
    items: [
      { href: "/admin/laporan", label: "Laporan", icon: ChartBar, hrOnly: true },
      { href: "/admin/pengumuman", label: "Pengumuman", icon: Megaphone, hrOnly: true },
      { href: "/admin/audit", label: "Audit Log", icon: Archive, saOnly: true },
    ],
  },
  {
    title: "Akun",
    items: [
      { href: "/admin/profil", label: "Profil", icon: UserCircle },
    ],
  },
];

// Halaman yang dibatasi per role — proteksi akses URL langsung di samping penyembunyian menu
const PAGE_ACCESS: { prefix: string; allow: (role: string) => boolean }[] = [
  { prefix: "/admin/karyawan", allow: (role) => role !== "manager" && role !== "supervisor" },
  { prefix: "/admin/akun", allow: isHr },
  { prefix: "/admin/lokasi", allow: (role) => role !== "manager" && role !== "supervisor" },
  { prefix: "/admin/master", allow: (role) => role !== "manager" && role !== "supervisor" },
  { prefix: "/admin/rekrutmen", allow: isHr },
  { prefix: "/admin/performa", allow: isHr },
  { prefix: "/admin/pelatihan", allow: isHr },
  { prefix: "/admin/aset", allow: isHr },
  { prefix: "/admin/laporan", allow: isHr },
  { prefix: "/admin/pengumuman", allow: isHr },
  { prefix: "/admin/audit", allow: (role) => role === "super_admin" },
  { prefix: "/admin/payroll", allow: isHr },
  { prefix: "/admin/reimbursements", allow: isHr },
];

function pageAccessAllowed(pathname: string, role: string): boolean {
  const rule = PAGE_ACCESS.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
  return !rule || rule.allow(role);
}

function SidebarContent({ onNavigate, onClose }: { onNavigate?: () => void; onClose?: () => void }) {
  const pathname = usePathname();
  const { state, dispatch } = useHris();
  const me = currentUser(state);
  const router = useRouter();
  const { logout } = useHris();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQ, setCmdQ] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  // ponytail: Cmd+K global search — filter karyawan/cuti/lembur in-memory
  useEffect(()=> { const h=(e:KeyboardEvent)=>{ if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){ e.preventDefault(); setCmdOpen(v=>!v); }}; window.addEventListener("keydown",h); return ()=> window.removeEventListener("keydown",h); },[]);

  const role = me?.user.role ?? "employee";
  const canNotif = isHr(role) || role === "manager" || role === "supervisor";
  const myNotifs = me
    ? state.data.notifications
        .filter((n) => n.userId === me.user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 8)
    : [];
  const unreadCount = me ? state.data.notifications.filter((n) => n.userId === me.user.id && !n.read).length : 0;

  function markNotifRead(id: string, read: boolean) {
    if (!read) dispatch({ type: "MARK_NOTIFICATION_READ", id });
  }
  function markAllNotifRead() {
    if (me) dispatch({ type: "MARK_ALL_NOTIFICATIONS_READ", userId: me.user.id });
  }
  function deleteNotif(id: string) {
    void dispatch({ type: "DELETE_NOTIFICATION", id });
  }

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center gap-2 border-b border-rule px-5 py-5">
        <Fingerprint size={22} weight="duotone" className="text-stamp" />
        <div className="flex-1">
          <p className="text-sm leading-tight font-bold tracking-tight">HRIS</p>
        </div>
        <button onClick={()=> setCmdOpen(true)} aria-label="Cari (Ctrl+K)" title="Cari (Ctrl+K)" className="btn-press inline-flex min-h-9 min-w-9 items-center justify-center rounded border border-rule bg-paper p-2 text-ink-soft hover:text-ink"><MagnifyingGlass size={16} weight="bold" /></button>
        {canNotif && (
          <button onClick={()=> setNotifOpen((v)=>!v)} aria-label="Notifikasi" title="Notifikasi" className="btn-press relative inline-flex min-h-9 min-w-9 items-center justify-center rounded border border-rule bg-paper p-2 text-ink-soft hover:text-ink">
            <Bell size={16} weight="bold" />
            {unreadCount > 0 && (
              <span className="tnum absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-stamp px-1 text-[9px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </button>
        )}
        {onClose && (
          <button onClick={onClose} aria-label="Tutup menu" className="btn-press inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-[4px] p-2 text-ink-soft hover:bg-black/5 hover:text-ink">
            <X size={18} weight="bold" />
          </button>
        )}
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

      {notifOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 p-4" onClick={()=> setNotifOpen(false)}>
          <div className="mt-16 w-full max-w-md overflow-hidden rounded-[12px] border border-rule bg-card shadow-xl" onClick={(e)=> e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-ledger/60 px-4 py-3">
              <p className="text-sm font-bold">Notifikasi</p>
              {unreadCount > 0 && (
                <button onClick={markAllNotifRead} className="btn-press cursor-pointer rounded px-2 py-1 text-xs font-semibold text-official hover:bg-official/5">Tandai semua dibaca</button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {myNotifs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <Bell size={28} weight="light" className="text-ink-faint" />
                  <p className="text-sm font-semibold text-ink">Belum ada notifikasi</p>
                </div>
              ) : (
                <ul className="divide-y divide-ledger/60">
                  {myNotifs.map((n) => (
                    <li key={n.id} className="relative">
                      {n.link ? (
                        <Link href={n.link} onClick={()=> { markNotifRead(n.id, n.read); setNotifOpen(false); }} className={`block px-4 py-3 pr-10 hover:bg-black/[0.02] ${!n.read ? "border-l-4 border-l-official bg-official/5" : ""}`}>
                          <NotifRow n={n} />
                        </Link>
                      ) : (
                        <div onClick={()=> { markNotifRead(n.id, n.read); setNotifOpen(false); }} className={`cursor-pointer px-4 py-3 pr-10 hover:bg-black/[0.02] ${!n.read ? "border-l-4 border-l-official bg-official/5" : ""}`}>
                          <NotifRow n={n} />
                        </div>
                      )}
                      <button
                        type="button"
                        aria-label="Hapus notifikasi"
                        title="Hapus"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); deleteNotif(n.id); }}
                        className="btn-press absolute top-2 right-2 cursor-pointer rounded-[4px] p-1.5 text-ink-faint hover:bg-black/[0.06] hover:text-stamp"
                      >
                        <Trash size={14} weight="bold" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Link href="/admin/notifikasi" onClick={()=> setNotifOpen(false)} className="block border-t border-ledger/60 px-4 py-2.5 text-center text-xs font-semibold text-official hover:bg-official/5">Lihat semua notifikasi</Link>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {GROUPS.map((g) => {
          const visible = g.items.filter((item) => {
            const role = me?.user.role ?? "employee";
            if (item.hrOnly && !isHr(role)) return false;
            if (item.saOnly && role !== "super_admin") return false;
            if (item.hiddenRoles?.includes(role)) return false;
            return true;
          });
          if (visible.length === 0) return null;
          return (
          <div key={g.title} className="mb-5">
            <p className="mb-1 px-2 font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
              {g.title}
            </p>
            <ul className="space-y-0.5">
              {visible.map((item) => {
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
          );
        })}

      </nav>

      <div className="border-t border-rule p-4">
        {me && (
          <div className="mb-3 flex items-center gap-2.5">
            <Avatar name={me.employee.name} size={34} src={me.employee.photoUrl} />
            <div className="min-w-0 flex-1">
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
  const pathname = usePathname();
  const me = currentUser(state);

  // jaring pengaman: sesi hilang (logout/kick nonaktifkan) → selalu kembali ke halaman masuk
  useEffect(() => {
    if (!state.session) router.replace("/");
  }, [state.session, router]);

  if (me && !pageAccessAllowed(pathname, me.user.role)) {
    return (
      <div className="min-h-[100dvh] lg:pl-64">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-rule lg:block">
          <SidebarContent />
        </aside>
        <main className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col items-center justify-center gap-2 px-4 text-center">
          <p className="text-lg font-bold tracking-tight">Tidak ada akses</p>
          <p className="max-w-sm text-sm text-ink-soft">Halaman ini hanya tersedia untuk role tertentu. Hubungi HR jika Anda merasa ini keliru.</p>
        </main>
      </div>
    );
  }

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
            <SidebarContent onNavigate={() => setOpen(false)} onClose={() => setOpen(false)} />
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

function NotifRow({ n }: { n: { title: string; body: string; read: boolean; createdAt: string } }) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${!n.read ? "font-semibold" : ""}`}>{n.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-soft">{n.body}</p>
        <p className="tnum mt-1 text-[10px] text-ink-faint">{new Date(n.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
      </div>
      {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-official" />}
    </div>
  );
}


