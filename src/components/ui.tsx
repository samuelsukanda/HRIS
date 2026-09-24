"use client";

import * as React from "react";
import { X } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { initials } from "@/lib/format";

export function Stamp({
  kind,
  children,
}: {
  kind: "approved" | "rejected" | "pending" | "neutral";
  children: ReactNode;
}) {
  return <span className={`stamp stamp-${kind}`}>{children}</span>;
}

export function StatusStamp({ status }: { status: string }) {
  const map: Record<string, [StampKind, string]> = {
    present: ["approved", "Present"],
    approved: ["approved", "Approved"],
    valid: ["approved", "Valid"],
    late: ["rejected", "Late"],
    rejected: ["rejected", "Rejected"],
    absent: ["rejected", "Absent"],
    early_leave: ["rejected", "Early Leave"],
    high: ["rejected", "High Risk"],
    pending: ["pending", "Pending"],
    spv_approved: ["pending", "Approved by SPV"],
    review: ["pending", "Review"],
    leave: ["neutral", "Leave"],
    sick: ["neutral", "Sick"],
    permission: ["neutral", "Permission"],
    wfh: ["neutral", "WFH"],
    business_trip: ["neutral", "Dinas"],
    low: ["approved", "Low Risk"],
    medium: ["pending", "Medium Risk"],
    cancelled: ["neutral", "Dibatalkan"],
  };
  const [kind, label] = map[status] ?? (["neutral", status] as [StampKind, string]);
  return <Stamp kind={kind}>{label}</Stamp>;
}
type StampKind = "approved" | "rejected" | "pending" | "neutral";

export function Btn({
  variant = "primary",
  size = "md",
  icon,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "official" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  icon?: Icon;
}) {
  const styles = {
    primary:
      "bg-stamp text-white border border-stamp-deep shadow-[0_1px_0_rgba(32,36,42,0.15)] hover:bg-stamp-deep",
    official:
      "bg-official text-white border border-official-deep shadow-[0_1px_0_rgba(32,36,42,0.15)] hover:bg-official-deep",
    secondary:
      "bg-card text-ink border border-rule hover:border-ink-faint hover:text-official-deep",
    ghost: "bg-transparent text-ink-soft border border-transparent hover:text-ink hover:bg-black/[0.04]",
    danger: "bg-card text-stamp-deep border border-stamp/40 hover:bg-stamp/5",
  }[variant];
  const sizes = {
    sm: "px-3 py-1.5 text-xs min-h-8",
    md: "px-4 py-2 text-sm min-h-9",
    lg: "px-5 py-2.5 text-sm min-h-10",
    icon: "p-2 min-h-9 min-w-9",
  }[size];
  const IconCmp = icon;
  return (
    <button
      {...props}
      className={`btn-press inline-flex cursor-pointer items-center justify-center gap-2 rounded-[4px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-official/30 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${sizes} ${className}`}
    >
      {IconCmp && <IconCmp size={size==="sm"?14:size==="icon"?16:16} weight="bold" />}
      {children}
    </button>
  );
}

export function IconBtn({
  label,
  icon: IconCmp,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: Icon }) {
  return (
    <button
      aria-label={label}
      title={label}
      {...props}
      className={`btn-press inline-flex cursor-pointer items-center justify-center rounded-[4px] p-2.5 min-h-9 min-w-9 border border-transparent text-ink-faint hover:bg-black/[0.04] hover:text-ink disabled:opacity-40 ${className}`}
    >
      <IconCmp size={16} weight="bold" />
    </button>
  );
}

export function Avatar({ name, src, size = 36 }: { name: string; src?: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center overflow-hidden border border-ledger bg-paper font-mono font-medium text-ink-soft"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials(name)}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold tracking-wide text-ink-soft uppercase">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-stamp-deep">{error}</span>}
    </label>
  );
}

const fieldBase =
  "w-full rounded-[4px] border border-rule bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-official focus:outline-none";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldBase} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldBase} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} rows={3} className={`${fieldBase} ${props.className ?? ""}`} />;
}

export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {sub && <p className="max-w-[65ch] text-sm leading-relaxed text-ink-soft">{sub}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body }: { icon: Icon; title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 border border-dashed border-rule px-6 py-14 text-center">
      <Icon size={28} className="text-ink-faint" weight="light" />
      <p className="font-semibold text-ink">{title}</p>
      {body && <p className="max-w-[45ch] text-sm text-ink-soft">{body}</p>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`max-h-[90dvh] w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} overflow-y-auto rounded-t-xl border border-rule bg-card p-6 sm:rounded-[6px]`}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="Tutup" className="btn-press cursor-pointer rounded-[4px] p-1 text-ink-soft hover:bg-black/5 hover:text-ink">
            <X size={18} weight="bold" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Pager({ page, total, limit, onChange }: { page: number; total: number; limit: number; onChange: (p: number) => void }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-rule bg-card px-4 py-3">
      <p className="text-xs text-ink-soft">
        Menampilkan {(page - 1) * limit + 1}–{Math.min(page * limit, total)} dari {total}
      </p>
      <div className="flex items-center gap-2">
        <Btn variant="secondary" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1}>
          ← Prev
        </Btn>
        <span className="px-2 font-mono text-xs text-ink-faint">{page}/{totalPages}</span>
        <Btn variant="secondary" size="sm" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
          Next →
        </Btn>
      </div>
    </div>
  );
}
