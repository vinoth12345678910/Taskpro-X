"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "./ui/cn";

type Theme = "light" | "dark";

function current(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle({ className, onRail }: { className?: string; onRail?: boolean }) {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => setTheme(current()), []);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("tpx-theme", next);
        } catch {}
        setTheme(next);
      }}
      aria-label={`Switch to ${next} theme`}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-md transition-colors",
        onRail ? "text-rail-ink-2 hover:bg-rail-2 hover:text-rail-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
