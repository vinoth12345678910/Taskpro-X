"use client";
import { AnimatePresence, m } from "motion/react";
import { CalendarDays, ChevronsUpDown, FolderOpen, LogOut, MessageSquare, Search, Users, WifiOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/components/providers/AuthProvider";
import { Dialog } from "@/components/ui/Dialog";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/Menu";
import { Avatar, Kbd, Logo } from "@/components/ui/misc";
import { cn } from "@/components/ui/cn";
import { useMediaQuery } from "@/components/useMediaQuery";
import { isOnline } from "@/lib/presence";
import type { ChatMessage } from "@/lib/types";
import { ChatView } from "./ChatView";
import { CommandPalette } from "./CommandPalette";
import { EventsView } from "./EventsView";
import { NotificationBell } from "./NotificationCenter";
import { PeopleView } from "./PeopleView";
import { ResourcesView } from "./ResourcesView";
import { ThreadPanel } from "./ThreadPanel";
import { useTeam } from "./TeamContext";
import { parseHash, toHash, type NavTarget, type View } from "./nav";

const NAV: { view: View; label: string; icon: typeof Users }[] = [
  { view: "chat", label: "Chat", icon: MessageSquare },
  { view: "events", label: "Events", icon: CalendarDays },
  { view: "resources", label: "Resources", icon: FolderOpen },
  { view: "people", label: "People", icon: Users },
];

export function Shell() {
  const t = useTeam();
  const { memberships, setActiveTeamId, profile, signOut } = useAuth();
  const wide = useMediaQuery("(min-width: 1280px)");

  const [view, setView] = useState<View>("chat");
  const [focusId, setFocusId] = useState<string | undefined>();
  const [thread, setThread] = useState<ChatMessage | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const navigate = useCallback(
    (target: NavTarget) => {
      if (target.teamId && target.teamId !== t.teamId) setActiveTeamId(target.teamId);
      setView(target.view);
      setFocusId(target.id);
      if (target.view === "chat" && target.threadOf) {
        const parent = t.messages.find((x) => x.id === target.threadOf);
        setThread(parent ?? { id: target.threadOf, roomId: target.teamId ?? t.teamId, text: "", timestamp: null, author: { uid: "", name: "", email: "", userType: "MEMBER" }, replyCount: 0, deleted: false, reactions: {}, mentions: [], pending: false });
      } else if (target.view !== "chat") {
        setThread(null);
      }
      history.replaceState(null, "", toHash(target));
    },
    [t.teamId, t.messages, setActiveTeamId],
  );

  // Restore view from the URL hash on load
  useEffect(() => {
    const h = parseHash(window.location.hash);
    setView(h.view);
    setFocusId(h.id);
    // deep links to a thread are resolved once messages load (see below)
  }, []);

  // Global shortcuts: Ctrl/Cmd+K search, Alt+1..4 switch view, Esc closes the thread
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.altKey && /^[1-4]$/.test(e.key)) {
        e.preventDefault();
        navigate({ view: NAV[Number(e.key) - 1].view });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const onlineCount = t.roster.filter((r) => isOnline(t.presence[r.uid])).length;
  const current = NAV.find((n) => n.view === view)!;
  const openThread = (msg: ChatMessage) => { setThread(msg); setView("chat"); };

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      {/* ---- Rail (desktop) ---- */}
      <aside className="on-rail hidden w-64 shrink-0 flex-col bg-rail text-rail-ink md:flex" aria-label="Workspace">
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
          <Logo size={26} />
          <span className="text-title font-semibold">TaskProX</span>
        </div>

        <div className="px-3">
          {memberships.length > 1 ? (
            <Menu
              align="start"
              trigger={
                <button className="flex w-full items-center justify-between gap-2 rounded-md border border-rail-line bg-rail-2 px-3 py-2 text-left hover:border-rail-ink-2" aria-label={`Team: ${t.teamName}. Switch team`}>
                  <span className="min-w-0">
                    <span className="block text-caption text-rail-ink-2">Team</span>
                    <span className="block truncate text-body font-medium">{t.teamName}</span>
                  </span>
                  <ChevronsUpDown size={16} className="shrink-0 text-rail-ink-2" aria-hidden="true" />
                </button>
              }
            >
              {memberships.map((mem) => (
                <MenuItem key={mem.id} onSelect={() => { setActiveTeamId(mem.teamLeadId); setThread(null); }}>
                  <span className={cn("truncate", mem.teamLeadId === t.teamId && "font-semibold")}>{mem.teamName}</span>
                </MenuItem>
              ))}
            </Menu>
          ) : (
            <div className="rounded-md border border-rail-line bg-rail-2 px-3 py-2">
              <span className="block text-caption text-rail-ink-2">Team</span>
              <span className="block truncate text-body font-medium">{t.teamName}</span>
            </div>
          )}
          <p className="mt-2 flex items-center gap-1.5 px-1 text-caption text-rail-ink-2">
            <span className="h-2 w-2 rounded-full bg-ok" aria-hidden="true" /> {onlineCount} of {t.roster.length} online
          </p>
        </div>

        <nav aria-label="Primary" className="mt-4 flex-1 space-y-0.5 px-3">
          {NAV.map(({ view: v, label, icon: Icon }, i) => (
            <button
              key={v}
              onClick={() => navigate({ view: v })}
              aria-current={view === v ? "page" : undefined}
              aria-keyshortcuts={`Alt+${i + 1}`}
              className={cn(
                "relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-body font-medium transition-colors",
                view === v ? "bg-rail-2 text-rail-ink" : "text-rail-ink-2 hover:bg-rail-2/60 hover:text-rail-ink",
              )}
            >
              {view === v && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded bg-accent" aria-hidden="true" />}
              <Icon size={18} aria-hidden="true" />
              {label}
              {v === "chat" && t.unreadCount > 0 && view !== "chat" && (
                <span className="ml-auto rounded-full bg-accent px-1.5 text-caption font-bold text-accent-ink" aria-label={`${t.unreadCount} unread messages`}>
                  {t.unreadCount > 99 ? "99+" : t.unreadCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="border-t border-rail-line p-3">
          <div className="flex items-center gap-2">
            <Menu
              align="start"
              trigger={
                <button className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-1.5 text-left hover:bg-rail-2" aria-label="Account menu">
                  <Avatar name={t.me.name} size={32} lead={t.isLead} />
                  <span className="min-w-0">
                    <span className="block truncate text-body font-medium">{t.me.name}</span>
                    <span className="block text-caption text-rail-ink-2">{t.isLead ? "Team lead" : "Member"}</span>
                  </span>
                </button>
              }
            >
              <div className="px-2.5 py-2 text-caption text-ink-3">{profile?.email}</div>
              <MenuSeparator />
              <MenuItem onSelect={() => void signOut()}>
                <LogOut size={15} aria-hidden="true" /> Sign out
              </MenuItem>
            </Menu>
            <ThemeToggle onRail />
          </div>
        </div>
      </aside>

      {/* ---- Main ---- */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-paper px-3 sm:px-5">
          <div className="flex items-center gap-2.5 md:hidden">
            <Logo size={24} />
            <span className="max-w-32 truncate text-title font-semibold">{t.teamName}</span>
          </div>
          <h1 className="hidden items-center gap-2 text-title font-semibold md:flex">
            <current.icon size={18} className="text-ink-3" aria-hidden="true" /> {current.label}
            <span className="font-normal text-ink-3">· {t.teamName}</span>
          </h1>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setPaletteOpen(true)}
              aria-label="Search"
              aria-keyshortcuts="Control+K Meta+K"
              className="flex h-9 items-center gap-2 rounded-md border border-line-strong bg-surface px-2.5 text-ink-3 hover:bg-surface-2 sm:w-56"
            >
              <Search size={16} aria-hidden="true" />
              <span className="hidden flex-1 text-left text-body sm:block">Search</span>
              <span className="hidden sm:block"><Kbd>Ctrl K</Kbd></span>
            </button>
            <NotificationBell onNavigate={navigate} />
            <span className="md:hidden"><ThemeToggle /></span>
          </div>
        </header>

        {!t.online && (
          <div role="status" className="flex items-center gap-2 border-b border-line bg-warn-soft px-4 py-1.5 text-caption font-medium text-warn md:hidden">
            <WifiOff size={14} aria-hidden="true" /> Offline
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <main id="main" tabIndex={-1} className="min-h-0 min-w-0 flex-1 focus:outline-none">
            <div className={cn("h-full", view !== "chat" && "hidden")}>
              <ChatView onOpenThread={openThread} active={view === "chat"} focusMessageId={view === "chat" ? focusId : undefined} />
            </div>
            <AnimatePresence mode="wait" initial={false}>
              {view !== "chat" && (
                <m.div
                  key={view}
                  className="h-full"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                >
                  {view === "events" && <EventsView focusEventId={focusId} />}
                  {view === "resources" && <ResourcesView />}
                  {view === "people" && <PeopleView />}
                </m.div>
              )}
            </AnimatePresence>
          </main>

          {wide && thread && view === "chat" && (
            <aside className="w-[24rem] shrink-0 border-l border-line">
              <ThreadPanel key={thread.id} parent={thread} onClose={() => setThread(null)} />
            </aside>
          )}
        </div>

        {/* ---- Bottom nav (mobile) ---- */}
        <nav aria-label="Primary" className="grid shrink-0 grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
          {NAV.map(({ view: v, label, icon: Icon }) => (
            <button
              key={v}
              onClick={() => navigate({ view: v })}
              aria-current={view === v ? "page" : undefined}
              className={cn("relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-caption font-medium", view === v ? "text-accent-text" : "text-ink-3")}
            >
              <Icon size={20} aria-hidden="true" />
              {label}
              {v === "chat" && t.unreadCount > 0 && view !== "chat" && (
                <span className="absolute right-[calc(50%-1.5rem)] top-1.5 h-2 w-2 rounded-full bg-accent" aria-label={`${t.unreadCount} unread messages`} />
              )}
            </button>
          ))}
        </nav>
      </div>

      {!wide && (
        <Dialog open={!!thread && view === "chat"} onOpenChange={(o) => !o && setThread(null)} title="Thread" variant="right" hideTitle className="!max-w-md [&>header]:hidden">
          {thread && <div className="h-[100dvh]"><ThreadPanel key={thread.id} parent={thread} onClose={() => setThread(null)} /></div>}
        </Dialog>
      )}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onNavigate={navigate} />
    </div>
  );
}
