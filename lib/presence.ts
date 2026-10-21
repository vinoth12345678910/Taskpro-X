import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "./firebase";
import { toDate } from "./firestore-utils";
import type { Presence } from "./types";

export const HEARTBEAT_MS = 60_000;
/** A heartbeat older than this means the person is offline. */
export const ONLINE_WINDOW_MS = 2.5 * HEARTBEAT_MS;

export function subscribePresence(teamId: string, cb: (p: Record<string, Presence>) => void) {
  return onSnapshot(
    query(collection(db, "presence"), where("teamId", "==", teamId)),
    (snap) => {
      const out: Record<string, Presence> = {};
      snap.docs.forEach((d) => {
        const x = d.data({ serverTimestamps: "estimate" });
        out[x.uid] = { uid: x.uid, status: x.status, lastSeen: toDate(x.lastSeen) };
      });
      cb(out);
    },
    () => cb({}), // presence is a nicety; failures are silent
  );
}

export function isOnline(p: Presence | undefined, now = Date.now()): boolean {
  return !!p?.lastSeen && now - p.lastSeen.getTime() < ONLINE_WINDOW_MS;
}

/** Start heartbeating for one team. Returns a stop function. */
export function startHeartbeat(teamId: string, uid: string): () => void {
  const ref = doc(db, "presence", `${teamId}_${uid}`);
  const beat = () => {
    const away = typeof document !== "undefined" && document.visibilityState === "hidden";
    void setDoc(ref, { teamId, uid, status: away ? "away" : "online", lastSeen: serverTimestamp() }).catch(() => undefined);
  };
  beat();
  const timer = setInterval(beat, HEARTBEAT_MS);
  const onVis = () => beat();
  document.addEventListener("visibilitychange", onVis);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVis);
    void deleteDoc(ref).catch(() => undefined);
  };
}
