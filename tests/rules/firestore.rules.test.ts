import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

/*
 * Cast: rules-unit-testing returns its own Firestore typing; the modular SDK
 * functions accept it at runtime.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

let env: RulesTestEnvironment;

const LEAD = "lead1"; // team lead of team "lead1"
const BOB = "bob"; // member of lead1
const CAROL = "carol"; // member of another team (lead2)
const LEAD2 = "lead2";
const DAVE = "dave"; // signed in, member of no team
const ADMIN = "admin1";

const db = (uid: string, email = `${uid}@example.com`): any =>
  env.authenticatedContext(uid, { email }).firestore();

const author = (uid: string, userType = "MEMBER") => ({
  uid,
  name: uid,
  email: `${uid}@example.com`,
  userType,
});

const newMessage = (uid: string, roomId = LEAD, extra: Record<string, unknown> = {}) => ({
  roomId,
  text: "hello team",
  timestamp: serverTimestamp(),
  author: author(uid, uid === roomId ? "TEAM_LEAD" : "MEMBER"),
  ...extra,
});

const inFuture = (hours: number) => Timestamp.fromMillis(Date.now() + hours * 3600_000);

const newEvent = (teamId = LEAD, extra: Record<string, unknown> = {}) => ({
  teamId,
  title: "Sprint review",
  description: "",
  startAt: inFuture(24),
  endAt: inFuture(25),
  timeZone: "Asia/Kolkata",
  status: "scheduled",
  createdBy: teamId,
  createdByName: "Lead",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "taskprox-rules-test",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const a: any = ctx.firestore();
    const user = (uid: string, role: string) =>
      setDoc(doc(a, "users", uid), { name: uid, email: `${uid}@example.com`, role, createdAt: Timestamp.now() });
    await Promise.all([
      user(LEAD, "team_lead"),
      user(LEAD2, "team_lead"),
      user(BOB, "member"),
      user(CAROL, "member"),
      user(DAVE, "member"),
      user(ADMIN, "admin"),
    ]);
    const member = (teamId: string, uid: string, userType: string) =>
      setDoc(doc(a, "team_members", `${teamId}_${uid}`), {
        uid,
        name: uid,
        email: `${uid}@example.com`,
        userType,
        teamLeadId: teamId,
        teamName: `Team ${teamId}`,
        joinedAt: Timestamp.now(),
      });
    await Promise.all([
      member(LEAD, LEAD, "TEAM_LEAD"),
      member(LEAD, BOB, "MEMBER"),
      member(LEAD2, LEAD2, "TEAM_LEAD"),
      member(LEAD2, CAROL, "MEMBER"),
    ]);
    await setDoc(doc(a, "team_invites", "ABC12345"), {
      code: "ABC12345",
      teamName: `Team ${LEAD}`,
      teamLeadId: LEAD,
      isActive: true,
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(a, "team_invites", "OLD00000"), {
      code: "OLD00000",
      teamName: `Team ${LEAD}`,
      teamLeadId: LEAD,
      isActive: false,
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(a, "chat_messages", "m1"), {
      roomId: LEAD,
      text: "first",
      timestamp: Timestamp.now(),
      author: author(BOB),
      replyCount: 0,
    });
    await setDoc(doc(a, "chat_messages", "m2"), {
      roomId: LEAD2,
      text: "other team secret",
      timestamp: Timestamp.now(),
      author: author(CAROL),
    });
    await setDoc(doc(a, "events", "e1"), {
      ...newEvent(LEAD),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });
});

describe("users / roles", () => {
  it("lets a user create their own member profile", async () => {
    await assertSucceeds(
      setDoc(doc(db("newbie"), "users", "newbie"), {
        name: "New",
        email: "newbie@example.com",
        role: "member",
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("refuses self-assigned admin at signup", async () => {
    await assertFails(
      setDoc(doc(db("evil"), "users", "evil"), {
        name: "Evil",
        email: "evil@example.com",
        role: "admin",
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("refuses role escalation on an existing profile", async () => {
    await assertFails(updateDoc(doc(db(BOB), "users", BOB), { role: "admin" }));
    await assertFails(updateDoc(doc(db(BOB), "users", BOB), { role: "team_lead" }));
    await assertSucceeds(updateDoc(doc(db(BOB), "users", BOB), { name: "Robert", lastLogin: serverTimestamp() }));
  });

  it("hides other users' profiles but lets admins list them", async () => {
    await assertFails(getDoc(doc(db(BOB), "users", LEAD)));
    await assertFails(getDocs(collection(db(BOB), "users")));
    await assertSucceeds(getDocs(collection(db(ADMIN), "users")));
  });
});

describe("invites and membership", () => {
  const joinDoc = (uid: string, over: Record<string, unknown> = {}) => ({
    uid,
    name: uid,
    email: `${uid}@example.com`,
    userType: "MEMBER",
    teamLeadId: LEAD,
    teamLeadName: "lead",
    teamLeadEmail: "lead@example.com",
    teamName: `Team ${LEAD}`,
    inviteCode: "ABC12345",
    joinedAt: serverTimestamp(),
    ...over,
  });

  it("joins with a valid active invite code", async () => {
    await assertSucceeds(setDoc(doc(db(DAVE), "team_members", `${LEAD}_${DAVE}`), joinDoc(DAVE)));
  });

  it("rejects: inactive code, wrong code, other team's code, forged id, impersonation, self-promotion", async () => {
    const d = db(DAVE);
    await assertFails(setDoc(doc(d, "team_members", `${LEAD}_${DAVE}`), joinDoc(DAVE, { inviteCode: "OLD00000" })));
    await assertFails(setDoc(doc(d, "team_members", `${LEAD}_${DAVE}`), joinDoc(DAVE, { inviteCode: "NOPE0000" })));
    await assertFails(setDoc(doc(d, "team_members", `${LEAD2}_${DAVE}`), joinDoc(DAVE, { teamLeadId: LEAD2 })));
    await assertFails(setDoc(doc(d, "team_members", `random-id`), joinDoc(DAVE)));
    await assertFails(setDoc(doc(d, "team_members", `${LEAD}_${BOB}`), joinDoc(BOB)));
    await assertFails(setDoc(doc(d, "team_members", `${LEAD}_${DAVE}`), joinDoc(DAVE, { userType: "TEAM_LEAD" })));
    await assertFails(setDoc(doc(d, "team_members", `${LEAD}_${DAVE}`), joinDoc(DAVE, { teamName: "Hijacked" })));
  });

  it("only a user whose stored role is team_lead can create a team", async () => {
    const lead = (uid: string) => ({
      uid,
      name: uid,
      email: `${uid}@example.com`,
      userType: "TEAM_LEAD",
      teamLeadId: uid,
      teamName: "My team",
      joinedAt: serverTimestamp(),
    });
    await assertFails(setDoc(doc(db(DAVE), "team_members", `${DAVE}_${DAVE}`), lead(DAVE))); // role member
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc((c as any).firestore(), "users", "newlead"), { name: "n", email: "newlead@example.com", role: "team_lead" });
    });
    await assertSucceeds(setDoc(doc(db("newlead"), "team_members", "newlead_newlead"), lead("newlead")));
  });

  it("invite codes can be fetched by id but never listed by outsiders", async () => {
    await assertSucceeds(getDoc(doc(db(DAVE), "team_invites", "ABC12345")));
    await assertFails(getDocs(collection(db(DAVE), "team_invites")));
    await assertSucceeds(getDocs(query(collection(db(LEAD), "team_invites"), where("teamLeadId", "==", LEAD))));
  });

  it("members see their team roster; outsiders and other teams do not", async () => {
    const q = (teamId: string) => query(collection(db(BOB), "team_members"), where("teamLeadId", "==", teamId));
    await assertSucceeds(getDocs(q(LEAD)));
    await assertFails(getDocs(q(LEAD2)));
    await assertFails(getDocs(query(collection(db(DAVE), "team_members"), where("teamLeadId", "==", LEAD))));
    await assertSucceeds(getDocs(query(collection(db(DAVE), "team_members"), where("uid", "==", DAVE))));
  });

  it("rosters can be listed by teamLeadId alone, admins can list leads, and non-members cannot list everything", async () => {
    // regression: a list query that filters only on teamLeadId must not error on the undefined `uid` field
    await assertSucceeds(getDocs(query(collection(db(LEAD), "team_members"), where("teamLeadId", "==", LEAD))));
    await assertSucceeds(getDocs(query(collection(db(ADMIN), "team_members"), where("userType", "==", "TEAM_LEAD"))));
    await assertFails(getDocs(query(collection(db(BOB), "team_members"), where("userType", "==", "TEAM_LEAD"))));
    await assertFails(getDocs(collection(db(DAVE), "team_members")));
  });

  it("only the lead may remove others; a member may leave; nobody else may delete", async () => {
    await assertFails(deleteDoc(doc(db(CAROL), "team_members", `${LEAD}_${BOB}`)));
    await assertFails(deleteDoc(doc(db(BOB), "team_members", `${LEAD}_${LEAD}`)));
    await assertSucceeds(deleteDoc(doc(db(LEAD), "team_members", `${LEAD}_${BOB}`)));
  });
});

describe("chat privacy and integrity", () => {
  it("members read and write their own team's room", async () => {
    await assertSucceeds(
      getDocs(query(collection(db(BOB), "chat_messages"), where("roomId", "==", LEAD), orderBy("timestamp", "desc"), limit(50))),
    );
    await assertSucceeds(setDoc(doc(db(BOB), "chat_messages", "new1"), newMessage(BOB)));
  });

  it("a member of another team cannot read or write this room (cross-team isolation)", async () => {
    await assertFails(
      getDocs(query(collection(db(CAROL), "chat_messages"), where("roomId", "==", LEAD), orderBy("timestamp"))),
    );
    await assertFails(getDoc(doc(db(CAROL), "chat_messages", "m1")));
    await assertFails(setDoc(doc(db(CAROL), "chat_messages", "x"), newMessage(CAROL, LEAD)));
    await assertFails(getDoc(doc(db(BOB), "chat_messages", "m2")));
  });

  it("signed-in users who are in no team see nothing", async () => {
    await assertFails(getDocs(query(collection(db(DAVE), "chat_messages"), where("roomId", "==", LEAD))));
    await assertFails(setDoc(doc(db(DAVE), "chat_messages", "x"), newMessage(DAVE, LEAD)));
  });

  it("cannot post as someone else or with client-forged state", async () => {
    await assertFails(setDoc(doc(db(BOB), "chat_messages", "a"), { ...newMessage(BOB), author: author(LEAD, "TEAM_LEAD") }));
    await assertFails(setDoc(doc(db(BOB), "chat_messages", "b"), newMessage(BOB, LEAD, { replyCount: 99 })));
    await assertFails(setDoc(doc(db(BOB), "chat_messages", "c"), newMessage(BOB, LEAD, { reactions: { [LEAD]: ["up"] } })));
    await assertFails(setDoc(doc(db(BOB), "chat_messages", "d"), { ...newMessage(BOB), text: "" }));
    await assertFails(setDoc(doc(db(BOB), "chat_messages", "e"), { ...newMessage(BOB), timestamp: Timestamp.fromMillis(1) }));
  });

  it("is idempotent for a retried send (same client-generated id)", async () => {
    const ref = doc(db(BOB), "chat_messages", "retry-1");
    await assertSucceeds(setDoc(ref, newMessage(BOB)));
    // A second identical write is an update with no changed fields except the server timestamp: it must not create another document.
    await assertFails(setDoc(ref, newMessage(BOB)));
    const snap = await getDocs(query(collection(db(BOB), "chat_messages"), where("roomId", "==", LEAD)));
    const ids = snap.docs.map((d: any) => d.id).filter((id: string) => id === "retry-1");
    if (ids.length !== 1) throw new Error("expected exactly one retry-1 document");
  });

  it("only the author edits; author or lead soft-deletes; no hard delete", async () => {
    await assertFails(updateDoc(doc(db(LEAD), "chat_messages", "m1"), { text: "tampered", editedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db(BOB), "chat_messages", "m1"), { text: "fixed", editedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(BOB), "chat_messages", "m1"), { text: "x", editedAt: serverTimestamp(), author: author(LEAD) }));
    await assertSucceeds(
      updateDoc(doc(db(LEAD), "chat_messages", "m1"), { deleted: true, text: "", deletedAt: serverTimestamp() }),
    );
    await assertFails(deleteDoc(doc(db(BOB), "chat_messages", "m1")));
    await assertFails(
      updateDoc(doc(db(CAROL), "chat_messages", "m1"), { deleted: true, text: "", deletedAt: serverTimestamp() }),
    );
  });

  it("reactions: anyone in the team may add their own, nobody may edit another person's", async () => {
    await assertSucceeds(updateDoc(doc(db(LEAD), "chat_messages", "m1"), { [`reactions.${LEAD}`]: ["up", "check"] }));
    await assertFails(updateDoc(doc(db(LEAD), "chat_messages", "m1"), { [`reactions.${BOB}`]: ["up"] }));
    await assertFails(updateDoc(doc(db(LEAD), "chat_messages", "m1"), { [`reactions.${LEAD}`]: ["💥"] }));
    await assertSucceeds(updateDoc(doc(db(LEAD), "chat_messages", "m1"), { [`reactions.${LEAD}`]: deleteField() }));
    await assertFails(updateDoc(doc(db(CAROL), "chat_messages", "m1"), { [`reactions.${CAROL}`]: ["up"] }));
    await assertFails(updateDoc(doc(db(BOB), "chat_messages", "m1"), { [`reactions.${BOB}`]: arrayUnion("up"), text: "x" }));
  });

  it("threads: reply + counter bump work; counter cannot be forged; other teams cannot reply", async () => {
    const reply = (uid: string) => ({
      roomId: LEAD,
      text: "a reply",
      timestamp: serverTimestamp(),
      author: author(uid, uid === LEAD ? "TEAM_LEAD" : "MEMBER"),
    });
    await assertSucceeds(setDoc(doc(db(LEAD), "chat_messages", "m1", "replies", "r1"), reply(LEAD)));
    await assertSucceeds(updateDoc(doc(db(LEAD), "chat_messages", "m1"), { replyCount: increment(1), lastReplyAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(LEAD), "chat_messages", "m1"), { replyCount: increment(5), lastReplyAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db(CAROL), "chat_messages", "m1", "replies", "r2"), { ...reply(CAROL), roomId: LEAD }));
    await assertFails(getDocs(collection(db(CAROL), "chat_messages", "m1", "replies")));
    await assertSucceeds(getDocs(collection(db(BOB), "chat_messages", "m1", "replies")));
    // a reply must claim the same room as its parent
    await assertFails(setDoc(doc(db(CAROL), "chat_messages", "m1", "replies", "r3"), { ...reply(CAROL), roomId: LEAD2 }));
  });
});

describe("events", () => {
  it("the team lead can create, edit and cancel; every member can read", async () => {
    await assertSucceeds(setDoc(doc(db(LEAD), "events", "e2"), newEvent(LEAD)));
    await assertSucceeds(getDoc(doc(db(BOB), "events", "e2")));
    await assertSucceeds(
      getDocs(query(collection(db(BOB), "events"), where("teamId", "==", LEAD), orderBy("startAt"))),
    );
    await assertSucceeds(updateDoc(doc(db(LEAD), "events", "e2"), { title: "Renamed", updatedAt: serverTimestamp() }));
    await assertSucceeds(
      updateDoc(doc(db(LEAD), "events", "e2"), { status: "cancelled", cancelledAt: serverTimestamp(), updatedAt: serverTimestamp() }),
    );
  });

  it("members and outsiders cannot create, modify, cancel or delete events (unauthorized users cannot edit protected events)", async () => {
    await assertFails(setDoc(doc(db(BOB), "events", "e3"), newEvent(LEAD, { createdBy: BOB })));
    await assertFails(setDoc(doc(db(BOB), "events", "e3"), newEvent(BOB)));
    await assertFails(setDoc(doc(db(LEAD), "events", "e4"), newEvent(LEAD2, { createdBy: LEAD }))); // lead of a different team
    await assertFails(updateDoc(doc(db(BOB), "events", "e1"), { status: "cancelled", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(CAROL), "events", "e1"), { title: "x", updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db(BOB), "events", "e1")));
    await assertFails(deleteDoc(doc(db(CAROL), "events", "e1")));
  });

  it("other teams cannot read this team's events", async () => {
    await assertFails(getDoc(doc(db(CAROL), "events", "e1")));
    await assertFails(getDocs(query(collection(db(CAROL), "events"), where("teamId", "==", LEAD), orderBy("startAt"))));
    await assertFails(getDocs(query(collection(db(DAVE), "events"), where("teamId", "==", LEAD), orderBy("startAt"))));
  });

  it("rejects invalid schedules (end <= start, >14 days, bad status, missing fields)", async () => {
    await assertFails(setDoc(doc(db(LEAD), "events", "bad1"), newEvent(LEAD, { endAt: inFuture(24) })));
    await assertFails(setDoc(doc(db(LEAD), "events", "bad2"), newEvent(LEAD, { endAt: inFuture(10) })));
    await assertFails(setDoc(doc(db(LEAD), "events", "bad3"), newEvent(LEAD, { endAt: inFuture(24 + 24 * 20) })));
    await assertFails(setDoc(doc(db(LEAD), "events", "bad4"), newEvent(LEAD, { status: "cancelled" })));
    await assertFails(setDoc(doc(db(LEAD), "events", "bad5"), newEvent(LEAD, { title: "" })));
    await assertFails(setDoc(doc(db(LEAD), "events", "bad6"), newEvent(LEAD, { startAt: "2026-01-01" })));
    await assertFails(setDoc(doc(db(LEAD), "events", "bad7"), newEvent(LEAD, { extra: "field" })));
    await assertFails(updateDoc(doc(db(LEAD), "events", "e1"), { endAt: inFuture(1), updatedAt: serverTimestamp() }));
  });

  it("is idempotent: a retried create with the same id cannot produce a second event", async () => {
    const ref = doc(db(LEAD), "events", "dup-1");
    await assertSucceeds(setDoc(ref, newEvent(LEAD)));
    // The retry is rejected (createdAt would change); the client treats "already exists" as success.
    await assertFails(setDoc(ref, newEvent(LEAD)));
    const snap = await getDocs(query(collection(db(LEAD), "events"), where("teamId", "==", LEAD), orderBy("startAt")));
    const n = snap.docs.filter((d: any) => d.id === "dup-1").length;
    if (n !== 1) throw new Error(`expected 1, got ${n}`);
    await assertSucceeds(getDoc(ref)); // existence probe used by the client after a failed retry
  });
});

describe("notifications", () => {
  const notif = (recipientId: string, actorUid: string, over: Record<string, unknown> = {}) => ({
    recipientId,
    teamId: LEAD,
    type: "mention",
    actor: { uid: actorUid, name: actorUid },
    title: "You were mentioned",
    body: "hi @bob",
    target: { kind: "message", id: "m1" },
    groupKey: "mention:m1",
    read: false,
    createdAt: serverTimestamp(),
    ...over,
  });

  it("teammates can notify each other; the recipient reads, others cannot", async () => {
    await assertSucceeds(setDoc(doc(db(LEAD), "notifications", "n1"), notif(BOB, LEAD)));
    await assertSucceeds(getDoc(doc(db(BOB), "notifications", "n1")));
    await assertSucceeds(getDocs(query(collection(db(BOB), "notifications"), where("recipientId", "==", BOB), orderBy("createdAt", "desc"))));
    await assertFails(getDoc(doc(db(LEAD), "notifications", "n1")));
    await assertFails(getDoc(doc(db(CAROL), "notifications", "n1")));
    await assertFails(getDocs(query(collection(db(CAROL), "notifications"), where("recipientId", "==", BOB))));
  });

  it("refuses spoofed actors, cross-team recipients, self-notifications and non-lead event notices", async () => {
    await assertFails(setDoc(doc(db(BOB), "notifications", "n2"), notif(LEAD, LEAD)));
    await assertFails(setDoc(doc(db(BOB), "notifications", "n3"), notif(CAROL, BOB)));
    await assertFails(setDoc(doc(db(CAROL), "notifications", "n4"), notif(BOB, CAROL)));
    await assertFails(setDoc(doc(db(BOB), "notifications", "n5"), notif(BOB, BOB)));
    await assertFails(setDoc(doc(db(BOB), "notifications", "n6"), notif(LEAD, BOB, { type: "event_created", target: { kind: "event", id: "e1" } })));
    await assertSucceeds(setDoc(doc(db(LEAD), "notifications", "n7"), notif(BOB, LEAD, { type: "event_created", target: { kind: "event", id: "e1" } })));
  });

  it("is deduplicated by deterministic id; the recipient can mark read but nothing else", async () => {
    await assertSucceeds(setDoc(doc(db(LEAD), "notifications", "mention_m1_bob"), notif(BOB, LEAD)));
    await assertFails(setDoc(doc(db(LEAD), "notifications", "mention_m1_bob"), notif(BOB, LEAD))); // retry cannot overwrite
    await assertFails(updateDoc(doc(db(LEAD), "notifications", "mention_m1_bob"), { read: true }));
    await assertSucceeds(updateDoc(doc(db(BOB), "notifications", "mention_m1_bob"), { read: true, readAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(BOB), "notifications", "mention_m1_bob"), { title: "edited" }));
  });
});

describe("shared resources", () => {
  const link = (uid: string, over: Record<string, unknown> = {}) => ({
    teamId: LEAD,
    kind: "link",
    name: "Design doc",
    description: "Spec",
    url: "https://example.com/spec",
    uploadedBy: uid,
    uploadedByName: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...over,
  });

  it("members add and read resources; outsiders and other teams cannot", async () => {
    await assertSucceeds(setDoc(doc(db(BOB), "resources", "r1"), link(BOB)));
    await assertSucceeds(getDocs(query(collection(db(LEAD), "resources"), where("teamId", "==", LEAD), orderBy("updatedAt", "desc"))));
    await assertFails(getDoc(doc(db(CAROL), "resources", "r1")));
    await assertFails(getDocs(query(collection(db(DAVE), "resources"), where("teamId", "==", LEAD))));
    await assertFails(setDoc(doc(db(CAROL), "resources", "r2"), link(CAROL)));
  });

  it("only the owner or the lead can change/delete; unsafe URLs and oversized files are refused", async () => {
    await assertSucceeds(setDoc(doc(db(BOB), "resources", "r1"), link(BOB)));
    await assertFails(updateDoc(doc(db(CAROL), "resources", "r1"), { name: "x", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db(LEAD), "resources", "r1"), { name: "Renamed", updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db(BOB), "resources", "r3"), link(BOB, { url: "javascript:alert(1)" })));
    const file = (over: Record<string, unknown> = {}) => ({
      teamId: LEAD,
      kind: "file",
      name: "a.pdf",
      storagePath: `teams/${LEAD}/resources/r4/a.pdf`,
      size: 1024,
      contentType: "application/pdf",
      uploadedBy: BOB,
      uploadedByName: BOB,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...over,
    });
    await assertSucceeds(setDoc(doc(db(BOB), "resources", "r4"), file()));
    await assertFails(setDoc(doc(db(BOB), "resources", "r5"), file({ size: 50 * 1024 * 1024 })));
    await assertFails(setDoc(doc(db(BOB), "resources", "r6"), file({ storagePath: `teams/${LEAD2}/resources/r6/a.pdf` })));
    await assertFails(deleteDoc(doc(db(CAROL), "resources", "r4")));
    await assertSucceeds(deleteDoc(doc(db(LEAD), "resources", "r4")));
    await assertSucceeds(deleteDoc(doc(db(BOB), "resources", "r1")));
  });
});

describe("default deny", () => {
  it("denies unknown collections, the legacy room_messages collection and anonymous access", async () => {
    await assertFails(getDoc(doc(db(LEAD), "room_messages", "x")));
    await assertFails(setDoc(doc(db(LEAD), "anything", "x"), { a: 1 }));
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore() as any, "chat_messages")));
    await assertFails(addDoc(collection(env.unauthenticatedContext().firestore() as any, "chat_messages"), newMessage(BOB)));
  });
});
