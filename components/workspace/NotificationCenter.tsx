"use client";
import { AnimatePresence, m } from "motion/react";
import { AtSign, Bell, BellOff, CalendarCheck, CalendarX, CalendarClock, CheckCheck, MessageSquareReply, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useNotifications } from "@/components/providers/NotificationsProvider";
import { useToast } from "@/components/providers/Toast";
import { Button } from "@/components/ui/Button";
import { Popover } from "@/components/ui/Menu";
import { ErrorState, Skeleton } from "@/components/ui/misc";
import { cn } from "@/components/ui/cn";
import { friendlyError } from "@/lib/firestore-utils";
import { groupNotifications, markAllRead, markRead, type NotificationGroup } from "@/lib/notifications";
import type { NotificationType } from "@/lib/types";
import type { NavTarget } from "./nav";

const ICONS: Record<NotificationType, typeof Bell> = {
  mention: AtSign,
  reply: MessageSquareReply,
  member_joined: UserPlus,
  event_created: CalendarCheck,
  event_updated: CalendarClock,
  event_cancelled: CalendarX,
};

const rel = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "short" });
export function timeAgo(d: Date | null): string {
  if (!d) return "now";
  const s = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(s);
  if (abs < 45) return "now";
  if (abs < 3600) return rel.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rel.format(Math.round(s / 3600), "hour");
  return rel.format(Math.round(s / 86400), "day");
}

function targetFor(g: NotificationGroup): NavTarget {
  const n = g.latest;
  if (n.target.kind === "event") return { view: "events", teamId: n.teamId, id: n.target.id };
  if (n.target.kind === "team") return { view: "people", teamId: n.teamId };
  return { view: "chat", teamId: n.teamId, id: n.target.id, threadOf: n.target.parentId ? n.target.parentId : undefined };
}

export function NotificationBell({ onNavigate }: { onNavigate: (t: NavTarget) => void }) {
  const { items, state, unread } = useNotifications();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => groupNotifications(items), [items]);

  async function openGroup(g: NotificationGroup) {
    setOpen(false);
    onNavigate(targetFor(g));
    try {
      await Promise.all(g.items.filter((n) => !n.read).map((n) => markRead(n.id)));
    } catch (e) {
      toast({ tone: "error", title: "Couldn't mark as read", description: friendlyError(e) });
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="w-[min(24rem,calc(100vw-1.5rem))]"
      trigger={
        <button
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative grid h-9 w-9 place-items-center rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <Bell size={19} aria-hidden="true" />
          <AnimatePresence>
            {unread > 0 && (
              <m.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                data-testid="unread-count"
                className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-accent-ink"
              >
                {unread > 99 ? "99+" : unread}
              </m.span>
            )}
          </AnimatePresence>
        </button>
      }
    >
      <div role="region" aria-label="Notifications">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-title font-semibold">Notifications</h2>
          <Button
            size="sm"
            variant="ghost"
            disabled={unread === 0}
            onClick={async () => {
              try {
                await markAllRead(items);
              } catch (e) {
                toast({ tone: "error", title: "Couldn't mark all as read", description: friendlyError(e) });
              }
            }}
          >
            <CheckCheck size={14} aria-hidden="true" /> Mark all read
          </Button>
        </div>
        <div className="max-h-[min(28rem,70dvh)] overflow-y-auto">
          {state === "loading" && (
            <div className="space-y-3 p-4" aria-busy="true">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {state === "error" && <ErrorState title="Couldn't load notifications">Check your connection and reopen this panel.</ErrorState>}
          {state === "ready" && groups.length === 0 && (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <BellOff size={24} className="mb-3 text-ink-3" aria-hidden="true" />
              <p className="text-body font-medium">You&apos;re all caught up</p>
              <p className="text-caption text-ink-3">Mentions, replies and event changes will show up here.</p>
            </div>
          )}
          {state === "ready" && groups.length > 0 && (
            <ul>
              {groups.map((g) => {
                const Icon = ICONS[g.type];
                const n = g.latest;
                return (
                  <li key={g.key}>
                    <button
                      onClick={() => void openGroup(g)}
                      className={cn("flex w-full gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-surface-2", g.unread > 0 && "bg-accent-soft/40")}
                    >
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-3 text-ink-2" aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className={cn("text-body", g.unread > 0 ? "font-semibold" : "font-medium")}>{n.title}</span>
                          <span className="shrink-0 text-caption text-ink-3">{timeAgo(n.createdAt)}</span>
                        </span>
                        {n.body && <span className="line-clamp-2 block text-caption text-ink-2">{n.body}</span>}
                        {g.items.length > 1 && (
                          <span className="mt-0.5 block text-caption text-ink-3">
                            {g.items.length} related updates{g.unread > 0 ? ` · ${g.unread} new` : ""}
                          </span>
                        )}
                      </span>
                      {g.unread > 0 && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Popover>
  );
}
