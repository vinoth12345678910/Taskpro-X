"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./ui/misc";
import { ThemeToggle } from "./ThemeToggle";

/** Two-column frame used by sign in / sign up. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="on-rail relative hidden flex-col justify-between bg-rail p-10 text-rail-ink lg:flex">
        <Link href="/" className="flex items-center gap-3 text-title font-semibold">
          <Logo size={32} /> TaskProX
        </Link>
        <div>
          <p className="max-w-sm text-display font-semibold tracking-tight">One calm place for your team to talk, plan and share.</p>
          <ul className="mt-8 space-y-3 text-body text-rail-ink-2">
            <li>Threaded conversations that stay on topic</li>
            <li>Events that show the right time for everyone</li>
            <li>Files and links your team can find again</li>
          </ul>
        </div>
        <p className="text-caption text-rail-ink-2">Sign-in is handled by Firebase Authentication.</p>
      </aside>
      <main id="main" className="relative flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center gap-2.5 text-title font-semibold lg:hidden">
            <Logo size={28} /> TaskProX
          </Link>
          <h1 className="text-heading font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-body text-ink-3">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-center text-body text-ink-3">{footer}</p>
        </div>
      </main>
    </div>
  );
}
