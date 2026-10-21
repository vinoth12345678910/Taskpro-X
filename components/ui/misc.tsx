"use client";
import type { ReactNode } from "react";
import { Crown } from "lucide-react";
import { cn } from "./cn";

export function Avatar({ name, size = 32, lead, self }: { name: string; size?: number; lead?: boolean; self?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.38) }}
      className={cn(
        "relative inline-grid shrink-0 place-items-center rounded-md font-semibold",
        self ? "bg-accent-soft text-accent-text" : "bg-surface-3 text-ink-2",
      )}
    >
      {initials}
      {lead && (
        <span className="absolute -bottom-1 -right-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-ink text-paper ring-2 ring-surface">
          <Crown size={8} />
        </span>
      )}
    </span>
  );
}

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "accent" | "ok" | "warn" | "danger" | "info"; children: ReactNode; className?: string }) {
  const tones = {
    neutral: "bg-surface-3 text-ink-2",
    accent: "bg-accent-soft text-accent-text",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    info: "bg-info-soft text-info",
  } as const;
  return <span className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-caption font-medium", tones[tone], className)}>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton", className)} />;
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-ink-3">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-12 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg bg-surface-2 text-ink-3" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-title font-semibold text-ink">{title}</h3>
      {children && <p className="mt-1 text-body text-ink-3">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", children, onRetry }: { title?: string; children?: ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-sm flex-col items-center px-4 py-12 text-center">
      <h3 className="text-title font-semibold text-ink">{title}</h3>
      {children && <p className="mt-1 text-body text-ink-3">{children}</p>}
      {onRetry && (
        <button onClick={onRetry} className="mt-4 h-9 rounded-md border border-line-strong bg-surface px-3 text-body font-medium hover:bg-surface-2">
          Try again
        </button>
      )}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-2">{children}</kbd>;
}

/** The TaskProX mark: ink tile with an accent cross. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="TaskProX">
      <rect width="32" height="32" rx="8" fill="var(--ink)" />
      <path d="M9.5 9.5l13 13M22.5 9.5l-13 13" stroke="var(--accent)" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M9.5 9.5l5.2 5.2" stroke="var(--paper)" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}
