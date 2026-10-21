"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useToast } from "@/components/providers/Toast";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { getBrowserTimeZone, utcToZonedLocal, zonedLocalToUtc } from "@/lib/datetime";
import { validateEventForm, EVENT_DESC_MAX, EVENT_TITLE_MAX, type EventFormErrors } from "@/lib/events";
import { createEvent, newEventId, updateEvent } from "@/lib/eventsService";
import { friendlyError } from "@/lib/firestore-utils";
import type { TeamEvent } from "@/lib/types";
import { useTeam } from "./TeamContext";

function timeZoneOptions(current: string): string[] {
  let all: string[] = [];
  try {
    all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {}
  const set = new Set(["UTC", current, ...all]);
  return [...set].sort();
}

/** Next whole hour as seen in `tz`, as a datetime-local string. */
function defaultStart(tz: string): string {
  const d = new Date(Math.ceil((Date.now() + 60_000) / 3_600_000) * 3_600_000);
  return utcToZonedLocal(d, tz);
}

function addMinutes(local: string, tz: string, minutes: number): string | null {
  const r = zonedLocalToUtc(local, tz);
  return r.ok ? utcToZonedLocal(new Date(r.date.getTime() + minutes * 60_000), tz) : null;
}

export function EventDialog({ open, onOpenChange, event }: { open: boolean; onOpenChange: (o: boolean) => void; event?: TeamEvent | null }) {
  const t = useTeam();
  const { toast } = useToast();
  const browserTz = useMemo(() => getBrowserTimeZone(), []);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tz, setTz] = useState(browserTz);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [errors, setErrors] = useState<EventFormErrors & { form?: string }>({});
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const eventId = useRef<string>("");
  const zones = useMemo(() => timeZoneOptions(event?.timeZone ?? browserTz), [event?.timeZone, browserTz]);

  // Reset the form each time it opens. A fresh id is minted per opening and reused on retry.
  useEffect(() => {
    if (!open) return;
    const zone = event?.timeZone ?? browserTz;
    setTitle(event?.title ?? "");
    setDescription(event?.description ?? "");
    setTz(zone);
    const s = event ? utcToZonedLocal(event.startAt, zone) : defaultStart(zone);
    setStart(s);
    setEnd(event ? utcToZonedLocal(event.endAt, zone) : (addMinutes(s, zone, 60) ?? s));
    setErrors({});
    eventId.current = event?.id ?? newEventId();
  }, [open, event, browserTz]);

  function changeStart(next: string) {
    // keep the duration when the start moves
    const a = zonedLocalToUtc(start, tz);
    const b = zonedLocalToUtc(end, tz);
    setStart(next);
    if (a.ok && b.ok) {
      const moved = addMinutes(next, tz, (b.date.getTime() - a.date.getTime()) / 60_000);
      if (moved) setEnd(moved);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    const v = validateEventForm({ title, description, start, end, timeZone: tz });
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    setErrors({});
    inFlight.current = true;
    setBusy(true);
    const payload = { title: v.title, description: v.description, startAt: v.startAt, endAt: v.endAt, timeZone: v.timeZone };
    try {
      if (event) {
        await updateEvent(t.me, t.roster, event.id, payload);
        toast({ tone: "success", title: "Event updated", description: "Your team has been notified." });
      } else {
        await createEvent(t.me, t.roster, eventId.current, payload);
        toast({ tone: "success", title: "Event scheduled", description: v.warnings[0] ?? "It's on everyone's calendar now." });
      }
      onOpenChange(false);
    } catch (err) {
      setErrors({ form: friendlyError(err, "We couldn't save this event. Your changes are still here, so you can try again.") });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)} title={event ? "Edit event" : "Schedule an event"} description="Everyone on the team sees this in their own time zone.">
      <form onSubmit={onSubmit} noValidate className="space-y-4 p-5">
        <Field label="Title" required error={errors.title} hint={`${title.length}/${EVENT_TITLE_MAX}`}>
          {(p) => <Input {...p} invalid={p.invalid} value={title} maxLength={EVENT_TITLE_MAX + 20} onChange={(e) => setTitle(e.target.value)} placeholder="Sprint planning" autoFocus />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" required error={errors.start}>
            {(p) => <Input {...p} invalid={p.invalid} type="datetime-local" value={start} onChange={(e) => changeStart(e.target.value)} />}
          </Field>
          <Field label="Ends" required error={errors.end}>
            {(p) => <Input {...p} invalid={p.invalid} type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />}
          </Field>
        </div>
        <Field label="Time zone" error={errors.timeZone} hint="Times above are read in this zone.">
          {(p) => (
            <select
              {...p}
              aria-invalid={p.invalid || undefined}
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-body text-ink hover:border-ink-3"
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Description" error={errors.description} hint={`Optional · ${description.length}/${EVENT_DESC_MAX}`}>
          {(p) => <Textarea {...p} invalid={p.invalid} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Agenda, meeting link, location…" />}
        </Field>
        {errors.form && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">
            {errors.form}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            {event ? "Save changes" : "Schedule event"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
