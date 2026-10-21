import {
  Timestamp,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import { toDate } from "./firestore-utils";
import { logError } from "./logger";
import type { Author, ChatMessage } from "./types";

export const PAGE_SIZE = 40;
export const MAX_MESSAGE_LENGTH = 4000;

export function mapMessage(snap: QueryDocumentSnapshot<DocumentData>, parentId?: string): ChatMessage {
  const d = snap.data({ serverTimestamps: "estimate" });
  return {
    id: snap.id,
    roomId: d.roomId,
    text: d.text ?? "",
    timestamp: toDate(d.timestamp) ?? null,
    author: d.author,
    replyCount: typeof d.replyCount === "number" ? d.replyCount : 0,
    lastReplyAt: toDate(d.lastReplyAt),
    editedAt: toDate(d.editedAt),
    deleted: d.deleted === true,
    reactions: (d.reactions ?? {}) as Record<string, string[]>,
    mentions: Array.isArray(d.mentions) ? d.mentions : [],
    pending: snap.metadata.hasPendingWrites,
    parentId,
  };
}

export const newMessageId = () => doc(collection(db, "chat_messages")).id;

const messageRef = (id: string) => doc(db, "chat_messages", id);
const replyRef = (parentId: string, id: string) => doc(db, "chat_messages", parentId, "replies", id);
export const refFor = (m: Pick<ChatMessage, "id" | "parentId">) => (m.parentId ? replyRef(m.parentId, m.id) : messageRef(m.id));

/**
 * Live window onto the newest messages. Only additions/modifications are reported: messages that
 * slide out of the limit window as new ones arrive are intentionally NOT removed (we never hard-delete).
 */
export function listenLatest(roomId: string, cb: (changed: ChatMessage[], ready: boolean) => void, onError: (e: unknown) => void) {
  const q = query(collection(db, "chat_messages"), where("roomId", "==", roomId), orderBy("timestamp", "desc"), limit(PAGE_SIZE));
  let first = true;
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => {
      const changed: ChatMessage[] = [];
      if (first) snap.docs.forEach((d) => changed.push(mapMessage(d)));
      else snap.docChanges({ includeMetadataChanges: true }).forEach((c) => c.type !== "removed" && changed.push(mapMessage(c.doc)));
      cb(changed, first);
      first = false;
    },
    (e) => {
      logError("chat", "message listener failed", e, { roomId });
      onError(e);
    },
  );
}

export async function fetchOlder(roomId: string, before: Date): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  const snap = await getDocs(
    query(
      collection(db, "chat_messages"),
      where("roomId", "==", roomId),
      orderBy("timestamp", "desc"),
      startAfter(Timestamp.fromDate(before)),
      limit(PAGE_SIZE),
    ),
  );
  return { messages: snap.docs.map((d) => mapMessage(d)), hasMore: snap.size === PAGE_SIZE };
}

export function listenReplies(parentId: string, cb: (items: ChatMessage[]) => void, onError: (e: unknown) => void) {
  return onSnapshot(
    query(collection(db, "chat_messages", parentId, "replies"), orderBy("timestamp", "asc"), limit(300)),
    { includeMetadataChanges: true },
    (snap) => cb(snap.docs.map((d) => mapMessage(d, parentId))),
    (e) => {
      logError("chat", "replies listener failed", e, { parentId });
      onError(e);
    },
  );
}

/** Idempotent: the caller supplies the id and reuses it on retry. */
export async function sendMessage(args: { id: string; roomId: string; author: Author; text: string; mentions: string[] }) {
  const ref = messageRef(args.id);
  try {
    await setDoc(ref, {
      roomId: args.roomId,
      text: args.text,
      timestamp: serverTimestamp(),
      author: args.author,
      mentions: args.mentions,
      replyCount: 0,
      reactions: {},
    });
  } catch (e) {
    // A retry after the first attempt actually landed is rejected as a forbidden update; that is success.
    if (await existsAlready(ref)) return;
    throw e;
  }
}

export async function sendReply(args: { parentId: string; id: string; roomId: string; author: Author; text: string; mentions: string[] }) {
  const ref = replyRef(args.parentId, args.id);
  const batch = writeBatch(db);
  batch.set(ref, {
    roomId: args.roomId,
    text: args.text,
    timestamp: serverTimestamp(),
    author: args.author,
    mentions: args.mentions,
    reactions: {},
  });
  batch.update(messageRef(args.parentId), { replyCount: increment(1), lastReplyAt: serverTimestamp() });
  try {
    await batch.commit();
  } catch (e) {
    if (await existsAlready(ref)) return;
    throw e;
  }
}

async function existsAlready(ref: DocumentReference): Promise<boolean> {
  try {
    return (await getDoc(ref)).exists();
  } catch {
    return false;
  }
}

export const editMessage = (m: Pick<ChatMessage, "id" | "parentId">, text: string, mentions: string[]) =>
  updateDoc(refFor(m), { text, mentions, editedAt: serverTimestamp() });

export const deleteMessage = (m: Pick<ChatMessage, "id" | "parentId">) =>
  updateDoc(refFor(m), { deleted: true, text: "", deletedAt: serverTimestamp() });

/** Add or remove the caller's reaction. `current` is the caller's present list. */
export function toggleReaction(m: Pick<ChatMessage, "id" | "parentId">, uid: string, code: string, current: string[]) {
  const has = current.includes(code);
  const next = has ? current.filter((c) => c !== code) : [...current, code];
  return updateDoc(refFor(m), { [`reactions.${uid}`]: next.length ? next : deleteField() });
}

/** Combine reactions into per-code counts for display. */
export function summarizeReactions(reactions: Record<string, string[]>) {
  const counts = new Map<string, string[]>();
  for (const [uid, codes] of Object.entries(reactions)) {
    for (const c of codes ?? []) counts.set(c, [...(counts.get(c) ?? []), uid]);
  }
  return counts;
}
