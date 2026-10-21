"use client";
import { CalendarDays, FileText, FolderOpen, Hash, MessageSquare, Search, Users, Link2, User } from "lucide-react";
import { useDeferredValue, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Dialog } from "@/components/ui/Dialog";
import { Kbd } from "@/components/ui/misc";
import { cn } from "@/components/ui/cn";
import { formatInZone, getBrowserTimeZone } from "@/lib/datetime";
import type { NavTarget } from "./nav";
import { useTeam } from "./TeamContext";

interface Item {
  id: string;
  group: string;
  label: string;
  detail?: string;
  icon: ReactNode;
  target: NavTarget;
}

const norm = (s: string) => s.toLowerCase();

/** Search across what the signed-in person is authorised to see: their teams, and this team's members, events, files and loaded messages. */
export function CommandPalette({ open, onOpenChange, onNavigate }: { open: boolean; onOpenChange: (o: boolean) => void; onNavigate: (t: NavTarget) => void }) {
  const t = useTeam();
  const { memberships } = useAuth();
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const [active, setActive] = useState(0);
  const listId = useId();
  const tz = useMemo(() => getBrowserTimeZone(), []);

  useEffect(() => {
    if (open) { setQ(""); setActive(0); }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const needle = norm(dq.trim());
    const all: Item[] = [
      { id: "v-chat", group: "Go to", label: "Chat", icon: <MessageSquare size={16} />, target: { view: "chat" } },
      { id: "v-events", group: "Go to", label: "Events", icon: <CalendarDays size={16} />, target: { view: "events" } },
      { id: "v-res", group: "Go to", label: "Resources", icon: <FolderOpen size={16} />, target: { view: "resources" } },
      { id: "v-people", group: "Go to", label: "People", icon: <Users size={16} />, target: { view: "people" } },
      ...memberships.filter((m) => m.teamLeadId !== t.teamId).map((m) => ({ id: `team-${m.teamLeadId}`, group: "Switch team", label: m.teamName, icon: <Hash size={16} />, target: { view: "chat" as const, teamId: m.teamLeadId } })),
      ...t.roster.map((r) => ({ id: `u-${r.uid}`, group: "People", label: r.name, detail: r.email, icon: <User size={16} />, target: { view: "people" as const } })),
      ...t.events.map((e) => ({
        id: `e-${e.id}`,
        group: "Events",
        label: e.title,
        detail: `${formatInZone(e.startAt, tz, { dateStyle: "medium", timeStyle: "short" })}${e.status === "cancelled" ? " · cancelled" : ""}`,
        icon: <CalendarDays size={16} />,
        target: { view: "events" as const, id: e.id },
      })),
      ...t.resources.map((r) => ({ id: `r-${r.id}`, group: "Resources", label: r.name, detail: r.description, icon: r.kind === "file" ? <FileText size={16} /> : <Link2 size={16} />, target: { view: "resources" as const } })),
      ...[...t.messages]
        .reverse()
        .filter((m) => !m.deleted && m.text)
        .map((m) => ({ id: `m-${m.id}`, group: "Messages (loaded history)", label: m.text.slice(0, 90), detail: m.author?.name, icon: <MessageSquare size={16} />, target: { view: "chat" as const, id: m.id } })),
    ];
    if (!needle) return all.filter((i) => i.group === "Go to" || i.group === "Switch team");
    return all.filter((i) => i.group !== "Go to" ? norm(`${i.label} ${i.detail ?? ""}`).includes(needle) : norm(i.label).includes(needle)).slice(0, 40);
  }, [dq, t.roster, t.events, t.resources, t.messages, memberships, t.teamId, tz]);

  useEffect(() => setActive(0), [dq]);

  function choose(i: Item | undefined) {
    if (!i) return;
    onOpenChange(false);
    onNavigate(i.target);
  }

  let lastGroup = "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Search" hideTitle description="Search people, events, files and messages" className="top-[15%] -translate-y-0 max-w-xl">
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-center gap-3">
          <Search size={18} className="text-ink-3" aria-hidden="true" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${t.teamName}…`}
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items[active] ? `${listId}-${active}` : undefined}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); choose(items[active]); }
            }}
            className="h-8 flex-1 bg-transparent text-body placeholder:text-ink-3 focus-visible:outline-none"
          />
        </div>
      </div>
      <ul id={listId} role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto p-2">
        {items.length === 0 && <li className="px-3 py-8 text-center text-body text-ink-3">No results for “{dq}”.</li>}
        {items.map((i, idx) => {
          const header = i.group !== lastGroup;
          lastGroup = i.group;
          return (
            <li key={i.id} role="presentation">
              {header && <p className="px-3 pb-1 pt-2 text-caption font-semibold uppercase tracking-wide text-ink-3">{i.group}</p>}
              <div
                id={`${listId}-${idx}`}
                role="option"
                aria-selected={idx === active}
                onMouseMove={() => setActive(idx)}
                onClick={() => choose(i)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-md px-3 py-2", idx === active && "bg-surface-2")}
              >
                <span className="text-ink-3" aria-hidden="true">{i.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body">{i.label}</span>
                  {i.detail && <span className="block truncate text-caption text-ink-3">{i.detail}</span>}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-caption text-ink-3">
        <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate</span>
        <span><Kbd>Enter</Kbd> open</span>
        <span className="ml-auto">Searches loaded messages only</span>
      </div>
    </Dialog>
  );
}
