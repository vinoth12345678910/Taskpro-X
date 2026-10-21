import {
  Timestamp,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { toDate } from "./firestore-utils";
import { logError, log } from "./logger";
import { formatInZone } from "./datetime";
import { notifyTeammates } from "./notifications";
import type { Membership, Profile, TeamEvent } from "./types";

/** Past events older than this are not loaded into the live view. */
export const EVENT_LOOKBACK_DAYS = 90;
const EVENT_LIMIT = 500;

export const newEventId = () => doc(collection(db, "events")).id;

function mapEvent(id: string, d: Record<string, unknown>): TeamEvent {
  return {
    id,
    teamId: d.teamId as string,
    title: d.title as string,
    description: (d.description as string) ?? "",
    startAt: toDate(d.startAt) ?? new Date(0),
    endAt: toDate(d.endAt) ?? new Date(0),
    timeZone: (d.timeZone as string) || "UTC",
    status: d.status === "cancelled" ? "cancelled" : "scheduled",
    createdBy: d.createdBy as string,
    createdByName: (d.createdByName as string) ?? "",
    updatedAt: toDate(d.updatedAt),
  };
}

export function subscribeEvents(teamId: string, cb: (events: TeamEvent[]) => void, onError: (e: unknown) => void) {
  const since = Timestamp.fromMillis(Date.now() - EVENT_LOOKBACK_DAYS * 86400_000);
  const q = query(
    collection(db, "events"),
    where("teamId", "==", teamId),
    where("startAt", ">=", since),
    orderBy("startAt", "asc"),
    limit(EVENT_LIMIT),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => mapEvent(d.id, d.data({ serverTimestamps: "estimate" })))),
    (e) => {
      logError("events", "listener failed", e, { teamId });
      onError(e);
    },
  );
}

export interface EventPayload {
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  timeZone: string;
}

/** e.g. "Mar 3, 2027, 9:00 AM GMT+5:30". (Intl forbids mixing dateStyle/timeStyle with timeZoneName.) */
export const eventSummary = (e: Pick<EventPayload, "startAt" | "timeZone">) =>
  formatInZone(
    e.startAt,
    e.timeZone,
    { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" },
    "en-US",
  );

async function fanOut(
  kind: "event_created" | "event_updated" | "event_cancelled",
  lead: Profile,
  roster: Membership[],
  eventId: string,
  ev: Pick<EventPayload, "title" | "startAt" | "timeZone">,
  rev: string,
) {
  const verb = { event_created: "New event", event_updated: "Event updated", event_cancelled: "Event cancelled" }[kind];
  await notifyTeammates(roster, {
    dedupeKey: `${eventId}-${rev}`,
    type: kind,
    teamId: lead.uid,
    actor: { uid: lead.uid, name: lead.name },
    title: `${verb}: ${ev.title}`,
    body: eventSummary(ev),
    target: { kind: "event", id: eventId },
    groupKey: `event:${eventId}`,
  });
}

/** Notifications must never break (or silently vanish from) the action that caused them. */
async function safeFanOut(...args: Parameters<typeof fanOut>) {
  try {
    await fanOut(...args);
  } catch (e) {
    logError("events", "notification fan-out failed", e, { eventId: args[3], kind: args[0] });
  }
}

/**
 * Create an event. `id` must be generated once per form session (`newEventId`) and reused on retry:
 * a repeated create can never produce a second document.
 */
export async function createEvent(lead: Profile, roster: Membership[], id: string, p: EventPayload): Promise<{ duplicate: boolean }> {
  const ref = doc(db, "events", id);
  try {
    await setDoc(ref, {
      teamId: lead.uid,
      title: p.title,
      description: p.description,
      startAt: Timestamp.fromDate(p.startAt),
      endAt: Timestamp.fromDate(p.endAt),
      timeZone: p.timeZone,
      status: "scheduled",
      createdBy: lead.uid,
      createdByName: lead.name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    let exists = false;
    try {
      exists = (await getDoc(ref)).exists();
    } catch {
      /* not readable → does not exist */
    }
    if (exists) {
      log("info", "events", "create retried after success; treated as duplicate", { eventId: id });
      return { duplicate: true };
    }
    logError("events", "create failed", e, { eventId: id });
    throw e;
  }
  void safeFanOut("event_created", lead, roster, id, p, "c");
  return { duplicate: false };
}

export async function updateEvent(lead: Profile, roster: Membership[], id: string, p: EventPayload) {
  try {
    await updateDoc(doc(db, "events", id), {
      title: p.title,
      description: p.description,
      startAt: Timestamp.fromDate(p.startAt),
      endAt: Timestamp.fromDate(p.endAt),
      timeZone: p.timeZone,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    logError("events", "update failed", e, { eventId: id });
    throw e;
  }
  void safeFanOut("event_updated", lead, roster, id, p, Date.now().toString(36));
}

export async function cancelEvent(lead: Profile, roster: Membership[], event: TeamEvent) {
  try {
    await updateDoc(doc(db, "events", event.id), { status: "cancelled", cancelledAt: serverTimestamp(), updatedAt: serverTimestamp() });
  } catch (e) {
    logError("events", "cancel failed", e, { eventId: event.id });
    throw e;
  }
  void safeFanOut("event_cancelled", lead, roster, event.id, event, "x");
}
