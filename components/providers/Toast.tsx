"use client";
import { AnimatePresence, m } from "motion/react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type Tone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: Tone;
  title: string;
  description?: string;
}
interface ToastApi {
  toast: (t: { tone?: Tone; title: string; description?: string; duration?: number }) => void;
}

const Ctx = createContext<ToastApi>({ toast: () => undefined });
export const useToast = () => useContext(Ctx);

const icons = { success: CheckCircle2, error: CircleAlert, info: Info };
const colors = { success: "text-ok", error: "text-danger", info: "text-info" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const toast = useCallback<ToastApi["toast"]>(
    ({ tone = "info", title, description, duration = 5000 }) => {
      const id = nextId.current++;
      setItems((xs) => [...xs.slice(-3), { id, tone, title, description }]);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {/* errors are assertive, everything else polite */}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:bottom-6 md:right-6 md:items-end">
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const Icon = icons[t.tone];
            return (
              <m.div
                key={t.id}
                layout="position"
                role={t.tone === "error" ? "alert" : "status"}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.16 }}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line bg-surface p-3 shadow-pop"
              >
                <Icon size={18} className={`mt-0.5 shrink-0 ${colors[t.tone]}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-body font-medium text-ink">{t.title}</p>
                  {t.description && <p className="text-caption text-ink-3">{t.description}</p>}
                </div>
                <button onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="rounded p-1 text-ink-3 hover:bg-surface-2">
                  <X size={14} aria-hidden="true" />
                </button>
              </m.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
