import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { toDate, isPermissionDenied } from "./firestore-utils";
import { log, logError } from "./logger";
import type { AppNotification, Membership, NotificationPrefs, NotificationType } from "./types";
import { DEFAULT_PREFS } from "./types";

const PREF_FOR_TYPE: Record<NotificationType, keyof NotificationPrefs> = {
  mention: "mentions",
  reply: "replies",
  member_joined: "joins",
  event_created: "events",
  event_updated: "events",
  event_cancelled: "events",
};

export function wantsNotification(recipient: Pick<Membership, "prefs">, type: NotificationType): boolean {
  const prefs = { ...DEFAULT_PREFS, ...(recipient.prefs ?? {}) };
  return prefs[PREF_FOR_TYPE[type]] !== false;
}

export interface NotifyInput {
  /** Stable key for the thing being notified about; combined with type + recipient to form the doc id. */
  dedupeKey: string;
  type: NotificationType;
  teamId: string;
  actor: { uid: string; name: string };
  title: string;
  body?: string;
  target: AppNotification["target"];
  groupKey: string;
}

export const notificationDocId = (type: NotificationType, dedupeKey: string, recipientId: string) =>
  `${type}_${dedupeKey}_${recipientId}`.replace(/[^A-Za-z0-9_-]/g, "-");

/**
 * Fan a notification out to teammates. Deterministic ids make this idempotent: a retry of
 * the same logical event hits an existing document, which the rules reject as a non-read
 * update — treated here as "already delivered", not as a failure.
 * Never throws: notification delivery must not break the action that caused it.
 */
export async function notifyTeammates(recipients: Membership[], input: NotifyInput): Promise<{ sent: number; skipped: number }> {
  const targets = recipients.filter((r) => r.uid !== input.actor.uid && wantsNotification(r, input.type));
  const results = await Promise.allSettled(
    targets.map((r) =>
      setDoc(doc(db, "notifications", notificationDocId(input.type, input.dedupeKey, r.uid)), {
        recipientId: r.uid,
        teamId: input.teamId,
        type: input.type,
        actor: input.actor,
        title: input.title.slice(0, 160),
        body: (input.body ?? "").slice(0, 240),
        target: input.target,
        groupKey: input.groupKey,
        read: false,
        createdAt: serverTimestamp(),
      }),
    ),
  );
  let sent = 0;
  results.forEach((r) => {
    if (r.status === "fulfilled") sent++;
    else if (!isPermissionDenied(r.reason)) logError("notifications", "delivery failed", r.reason, { type: input.type });
  });
  const skipped = targets.length - sent;
  if (skipped) log("debug", "notifications", "some deliveries skipped (duplicate or not permitted)", { type: input.type, skipped });
  return { sent, skipped };
}

function mapNotification(id: string, d: Record<string, unknown>): AppNotification {
  return {
    id,
    recipientId: d.recipientId as string,
    teamId: d.teamId as string,
    type: d.type as NotificationType,
    actor: d.actor as AppNotification["actor"],
    title: (d.title as string) ?? "",
    body: (d.body as string) ?? "",
    target: d.target as AppNotification["target"],
    groupKey: (d.groupKey as string) ?? id,
    read: d.read === true,
    createdAt: toDate(d.createdAt) ?? null,
  };
}

export function subscribeNotifications(
  uid: string,
  cb: (items: AppNotification[]) => void,
  onError: (e: unknown) => void,
  max = 100,
) {
  const q = query(collection(db, "notifications"), where("recipientId", "==", uid), orderBy("createdAt", "desc"), limit(max));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => mapNotification(d.id, d.data({ serverTimestamps: "estimate" })))),
    (e) => {
      logError("notifications", "listener failed", e);
      onError(e);
    },
  );
}

export const markRead = (id: string) => updateDoc(doc(db, "notifications", id), { read: true, readAt: serverTimestamp() });

export async function markAllRead(items: AppNotification[]) {
  const unread = items.filter((n) => !n.read);
  for (let i = 0; i < unread.length; i += 400) {
    const batch = writeBatch(db);
    unread.slice(i, i + 400).forEach((n) => batch.update(doc(db, "notifications", n.id), { read: true, readAt: serverTimestamp() }));
    await batch.commit();
  }
}

export interface NotificationGroup {
  key: string;
  type: NotificationType;
  items: AppNotification[]; // newest first
  latest: AppNotification;
  unread: number;
}

/** Collapse related notifications (e.g. several replies in one thread) into one row. */
export function groupNotifications(list: AppNotification[]): NotificationGroup[] {
  const map = new Map<string, NotificationGroup>();
  for (const n of list) {
    const key = `${n.type}:${n.groupKey}`;
    const g = map.get(key);
    if (g) {
      g.items.push(n);
      if (!n.read) g.unread++;
    } else {
      map.set(key, { key, type: n.type, items: [n], latest: n, unread: n.read ? 0 : 1 });
    }
  }
  const t = (n: AppNotification) => n.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return [...map.values()]
    .map((g) => {
      g.items.sort((a, b) => t(b) - t(a));
      g.latest = g.items[0];
      return g;
    })
    .sort((a, b) => t(b.latest) - t(a.latest));
}
