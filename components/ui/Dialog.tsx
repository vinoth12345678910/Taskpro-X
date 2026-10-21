"use client";
import * as RDialog from "@radix-ui/react-dialog";
import { AnimatePresence, m } from "motion/react";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** `center` modal, or a `right` / `bottom` sheet */
  variant?: "center" | "right";
  className?: string;
  hideTitle?: boolean;
}

/** Accessible modal built on Radix (focus trap, Escape, aria) with restrained enter/exit motion. */
export function Dialog({ open, onOpenChange, title, description, children, variant = "center", className, hideTitle }: DialogProps) {
  const right = variant === "right";
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <m.div
                className="fixed inset-0 z-50 bg-[var(--overlay)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              />
            </RDialog.Overlay>
            <RDialog.Content asChild forceMount aria-describedby={description ? undefined : undefined}>
              <m.div
                className={cn(
                  "fixed z-50 flex flex-col bg-surface text-ink shadow-pop focus:outline-none",
                  right
                    ? "inset-y-0 right-0 w-full max-w-md border-l border-line"
                    : "left-1/2 top-1/2 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line",
                  className,
                )}
                initial={right ? { opacity: 0, x: 24 } : { opacity: 0, y: 8, scale: 0.98 }}
                animate={right ? { opacity: 1, x: 0 } : { opacity: 1, y: 0, scale: 1 }}
                exit={right ? { opacity: 0, x: 24 } : { opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                  <div className="min-w-0">
                    <RDialog.Title className={cn("text-title font-semibold", hideTitle && "sr-only")}>{title}</RDialog.Title>
                    {description ? (
                      <RDialog.Description className="mt-0.5 text-caption text-ink-3">{description}</RDialog.Description>
                    ) : (
                      <RDialog.Description className="sr-only">{title}</RDialog.Description>
                    )}
                  </div>
                  <RDialog.Close
                    aria-label="Close"
                    className="-mr-2 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
                  >
                    <X size={18} aria-hidden="true" />
                  </RDialog.Close>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
              </m.div>
            </RDialog.Content>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}
