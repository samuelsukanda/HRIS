"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CalendarBlank,
  Fingerprint,
  HandHeart,
  House,
  SignOut,
  UserCircle,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { currentUser, useHris } from "@/lib/store";

const NAV: { href: string; label: string; icon: Icon }[] = [
  { href: "/app", label: "Beranda", icon: House },
  { href: "/app/absensi", label: "Absensi", icon: Fingerprint },
  { href: "/app/jadwal", label: "Jadwal", icon: CalendarBlank },
  { href: "/app/cuti", label: "Cuti", icon: HandHeart },
  { href: "/app/profil", label: "Profil", icon: UserCircle },
];

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, dispatch, logout } = useHris();
  const me = currentUser(state);
  const unreadCount = me ? state.data.notifications.filter((n) => n.userId === me.user.id && !n.read).length : 0;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col border-x border-rule bg-paper">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-rule bg-card/95 px-5 py-3 backdrop-blur-sm">
        <div>
          <p className="font-mono text-[10px] tracking-widest text-ink-faint uppercase">HRIS</p>
          <p className="text-sm leading-tight font-bold">{me ? `Hai, ${me.employee.name.split(" ")[0]}` : "…"}</p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/app/notifications"
            className="btn-press relative cursor-pointer rounded-[4px] p-2 text-ink-soft hover:bg-black/5 hover:text-official"
            aria-label="Notifikasi"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-stamp text-[9px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </Link>
          <button
            onClick={() => {
              void logout().then(() => router.push("/"));
            }}
            aria-label="Keluar"
            className="btn-press cursor-pointer rounded-[4px] p-2 text-ink-soft hover:bg-black/5 hover:text-stamp"
          >
            <SignOut size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pt-5 pb-24">{children}</main>

      {/* Navigasi bawah */}
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-lg items-stretch justify-around border-t border-rule bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"
      >
        {NAV.map((item) => {
          const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-16 flex-col items-center gap-0.5 px-2 py-2.5 text-[10px] font-semibold tracking-wide uppercase transition-colors ${
                active ? "text-stamp-deep" : "text-ink-faint hover:text-ink"
              }`}
            >
              <item.icon size={21} weight={active ? "fill" : "regular"} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
