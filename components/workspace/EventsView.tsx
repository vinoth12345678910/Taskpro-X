"use client";
import * as Tabs from "@radix-ui/react-tabs";
import { AnimatePresence, m } from "motion/react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Pencil, Plus, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/providers/Toast";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, ErrorState, Badge, Skeleton } from "@/components/ui/misc";
import { cn } from "@/components/ui/cn";
import { dayKey, formatInZone, getBrowserTimeZone, zoneAbbreviation } from "@/lib/datetime";
import { cancelEvent } from "@/lib/eventsService";
import { friendlyError } from "@/lib/firestore-utils";
import type { TeamEvent } from "@/lib/types";
import { EventDialog } from "./EventDialog";
import { useTeam } from "./TeamContext";

const dayHeading = (d: Date, tz: string) => formatInZone(d, tz, { weekday: "long", month: "long", day: "numeric" });
const timeOnly = (d: Date, tz: string) => formatInZone(d, tz, { hour: "numeric", minute: "2-digit" });

function EventCard({ ev, tz, canManage, highlight, onEdit, onCancel }: { ev: TeamEvent; tz: string; canManage: boolean; highlight: boolean; onEdit: () => void; onCancel: () => void }) {
  const cancelled = ev.status === "cancelled";
  const sameDay = dayKey(ev.startAt, tz) === dayKey(ev.endAt, tz);
  const minutes = Math.round((ev.endAt.getTime() - ev.startAt.getTime()) / 60_000);
  const duration = minutes >= 1440 ? `${(minutes / 1440).toFixed(minutes % 1440 ? 1 : 0)} d` : minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} m` : ""}` : `${minutes} m`;
  const differs = ev.timeZone !== tz;
  return (
    <m.li
      layout="position"
      id={`event-${ev.id}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className={cn("flex gap-4 rounded-lg border bg-surface p-4", highlight ? "border-accent ring-1 ring-accent" : "border-line", cancelled && "opacity-70")}
    >
      <div className="w-20 shrink-0 text-right">
        <time dateTime={ev.startAt.toISOString()} className="block text-title font-semibold tabular-nums">
          {timeOnly(ev.startAt, tz)}
        </time>
        <span className="block text-caption text-ink-3">{zoneAbbreviation(ev.startAt, tz)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={cn("text-title font-semibold", cancelled && "line-through")}>{ev.title}</h3>
          {cancelled && <Badge tone="danger">Cancelled</Badge>}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption text-ink-3">
          <Clock size={12} aria-hidden="true" />
          <span>
            {timeOnly(ev.startAt, tz)} – {sameDay ? timeOnly(ev.endAt, tz) : formatInZone(ev.endAt, tz, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {duration}
          </span>
          {differs && (
            <span>
              · {formatInZone(ev.startAt, ev.timeZone, { hour: "numeric", minute: "2-digit" })} {zoneAbbreviation(ev.startAt, ev.timeZone)} where it was scheduled
            </span>
          )}
        </p>
        {ev.description && <p className="mt-2 whitespace-pre-wrap break-words text-body text-ink-2">{ev.description}</p>}
        <p className="mt-2 text-caption text-ink-3">Scheduled by {ev.createdByName || "team lead"}</p>
      </div>
      {canManage && !cancelled && (
        <div className="flex shrink-0 items-start gap-1">
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label={`Edit ${ev.title}`}>
            <Pencil size={16} aria-hidden="true" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onCancel} aria-label={`Cancel ${ev.title}`}>
            <XCircle size={16} aria-hidden="true" />
          </Button>
        </div>
      )}
    </m.li>
  );
}

function groupByDay(events: TeamEvent[], tz: string) {
  const groups = new Map<string, TeamEvent[]>();
  for (const e of events) {
    const k = dayKey(e.startAt, tz);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return [...groups.entries()];
}

function MonthGrid({ events, tz, selected, onSelect }: { events: TeamEvent[]; tz: string; selected: string; onSelect: (k: string) => void }) {
  const [cursor, setCursor] = useState(() => {
    const [y, mo] = dayKey(new Date(), tz).split("-").map(Number);
    return { y, m: mo - 1 };
  });
  const todayKey = dayKey(new Date(), tz);
  const byDay = useMemo(() => {
    const map = new Map<string, TeamEvent[]>();
    for (const e of events) map.set(dayKey(e.startAt, tz), [...(map.get(dayKey(e.startAt, tz)) ?? []), e]);
    return map;
  }, [events, tz]);

  const first = new Date(Date.UTC(cursor.y, cursor.m, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday-first
  const days = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => {
    const d = i - lead + 1;
    return d >= 1 && d <= days ? `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
  });
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const shift = (n: number) => setCursor((c) => ({ y: c.y + Math.floor((c.m + n) / 12), m: (((c.m + n) % 12) + 12) % 12 }));

  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-title font-semibold" aria-live="polite">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={18} aria-hidden="true" /></Button>
          <Button size="sm" variant="ghost" onClick={() => { const [y, mo] = todayKey.split("-").map(Number); setCursor({ y, m: mo - 1 }); onSelect(todayKey); }}>Today</Button>
          <Button size="icon" variant="ghost" aria-label="Next month" onClick={() => shift(1)}><ChevronRight size={18} aria-hidden="true" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-caption font-medium text-ink-3" aria-hidden="true">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label={monthLabel}>
        {cells.map((k, i) => {
          if (!k) return <div key={i} role="gridcell" aria-hidden="true" />;
          const list = byDay.get(k) ?? [];
          const active = list.filter((e) => e.status === "scheduled").length;
          return (
            <button
              key={k}
              role="gridcell"
              onClick={() => onSelect(k)}
              aria-selected={selected === k}
              aria-label={`${k}${active ? `, ${active} event${active > 1 ? "s" : ""}` : ", no events"}${k === todayKey ? ", today" : ""}`}
              className={cn(
                "relative flex aspect-square min-h-11 flex-col items-center justify-start rounded-md border p-1 text-body transition-colors sm:aspect-[4/3]",
                selected === k ? "border-ink bg-surface-2" : "border-transparent hover:bg-surface-2",
                k === todayKey && "font-semibold text-accent-text",
              )}
            >
              <span>{Number(k.slice(8))}</span>
              {list.length > 0 && (
                <span className="mt-auto flex gap-0.5" aria-hidden="true">
                  {list.slice(0, 3).map((e) => (
                    <span key={e.id} className={cn("h-1.5 w-1.5 rounded-full", e.status === "cancelled" ? "bg-ink-3" : "bg-accent")} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function EventsView({ focusEventId }: { focusEventId?: string }) {
  const t = useTeam();
  const { toast } = useToast();
  const tz = useMemo(() => getBrowserTimeZone(), []);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const [tab, setTab] = useState("upcoming");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeamEvent | null>(null);
  const [cancelling, setCancelling] = useState<TeamEvent | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => dayKey(new Date(), tz));

  const upcoming = useMemo(() => t.events.filter((e) => e.endAt.getTime() >= now), [t.events, now]);
  const past = useMemo(() => t.events.filter((e) => e.endAt.getTime() < now).reverse(), [t.events, now]);
  const dayEvents = useMemo(() => t.events.filter((e) => dayKey(e.startAt, tz) === selectedDay), [t.events, selectedDay, tz]);

  useEffect(() => {
    if (!focusEventId || t.eventsState !== "ready") return;
    const ev = t.events.find((e) => e.id === focusEventId);
    if (ev) setTab(ev.endAt.getTime() < Date.now() ? "past" : "upcoming");
    requestAnimationFrame(() => document.getElementById(`event-${focusEventId}`)?.scrollIntoView({ block: "center" }));
  }, [focusEventId, t.eventsState, t.events]);

  const renderList = (list: TeamEvent[], emptyTitle: string, emptyBody: string) =>
    list.length === 0 ? (
      <EmptyState
        icon={<CalendarDays size={22} />}
        title={emptyTitle}
        action={t.isLead && tab === "upcoming" ? <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={16} aria-hidden="true" /> Schedule an event</Button> : undefined}
      >
        {emptyBody}
      </EmptyState>
    ) : (
      <div className="space-y-6">
        {groupByDay(list, tz).map(([k, items]) => (
          <section key={k} aria-labelledby={`day-${k}`}>
            <h3 id={`day-${k}`} className="mb-2 text-caption font-semibold uppercase tracking-wide text-ink-3">
              {dayHeading(items[0].startAt, tz)}
            </h3>
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {items.map((ev) => (
                  <EventCard
                    key={ev.id}
                    ev={ev}
                    tz={tz}
                    canManage={t.isLead}
                    highlight={ev.id === focusEventId}
                    onEdit={() => { setEditing(ev); setFormOpen(true); }}
                    onCancel={() => setCancelling(ev)}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </section>
        ))}
      </div>
    );

  return (
    <div className="mx-auto h-full w-full max-w-4xl overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-heading font-semibold tracking-tight">Events</h2>
          <p className="text-body text-ink-3">Shown in your time zone ({tz.replace(/_/g, " ")}).</p>
        </div>
        {t.isLead && (
          <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus size={16} aria-hidden="true" /> New event
          </Button>
        )}
      </div>

      {t.eventsState === "loading" && (
        <div className="space-y-2" aria-busy="true" aria-label="Loading events">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      )}
      {t.eventsState === "error" && (
        <ErrorState title="Couldn't load events" onRetry={t.retry}>
          Check your connection and try again.
        </ErrorState>
      )}
      {t.eventsState === "ready" && (
        <Tabs.Root value={tab} onValueChange={setTab}>
          <Tabs.List aria-label="Event views" className="mb-4 inline-flex rounded-md bg-surface-2 p-1">
            {[
              ["upcoming", `Upcoming${upcoming.length ? ` (${upcoming.filter((e) => e.status === "scheduled").length})` : ""}`],
              ["calendar", "Calendar"],
              ["past", "Past"],
            ].map(([v, label]) => (
              <Tabs.Trigger
                key={v}
                value={v}
                className="rounded px-3.5 py-1.5 text-body font-medium text-ink-3 transition-colors data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-card"
              >
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <Tabs.Content value="upcoming" className="focus-visible:outline-offset-4">
            {renderList(upcoming, "Nothing scheduled", t.isLead ? "Schedule your first event and your team will be notified." : "When your team lead schedules an event, it will show up here.")}
          </Tabs.Content>
          <Tabs.Content value="calendar" className="space-y-4">
            <MonthGrid events={t.events} tz={tz} selected={selectedDay} onSelect={setSelectedDay} />
            <section aria-live="polite">
              <h3 className="mb-2 text-caption font-semibold uppercase tracking-wide text-ink-3">{formatInZone(new Date(`${selectedDay}T12:00:00Z`), "UTC", { weekday: "long", month: "long", day: "numeric" })}</h3>
              {dayEvents.length === 0 ? (
                <p className="text-body text-ink-3">No events on this day.</p>
              ) : (
                <ul className="space-y-2">
                  {dayEvents.map((ev) => (
                    <EventCard key={ev.id} ev={ev} tz={tz} canManage={t.isLead} highlight={ev.id === focusEventId} onEdit={() => { setEditing(ev); setFormOpen(true); }} onCancel={() => setCancelling(ev)} />
                  ))}
                </ul>
              )}
            </section>
          </Tabs.Content>
          <Tabs.Content value="past">
            {renderList(past, "No past events", "Events from the last 90 days appear here.")}
          </Tabs.Content>
        </Tabs.Root>
      )}

      <EventDialog open={formOpen} onOpenChange={setFormOpen} event={editing} />
      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
        title={`Cancel “${cancelling?.title ?? ""}”?`}
        description="Your team will be notified. The event stays in the list marked as cancelled."
        confirmLabel="Cancel event"
        onConfirm={async () => {
          if (!cancelling) return;
          try {
            await cancelEvent(t.me, t.roster, cancelling);
            toast({ tone: "success", title: "Event cancelled" });
          } catch (e) {
            toast({ tone: "error", title: "Couldn't cancel the event", description: friendlyError(e) });
          }
        }}
      />
    </div>
  );
}
