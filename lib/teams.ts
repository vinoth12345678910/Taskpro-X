import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { randomCode, toDate } from "./firestore-utils";
import { logError } from "./logger";
import { notifyTeammates } from "./notifications";
import type { Membership, NotificationPrefs, Profile, UserType } from "./types";

export const membershipId = (teamId: string, uid: string) => `${teamId}_${uid}`;

export function mapMembership(id: string, d: Record<string, unknown>): Membership {
  return {
    id,
    uid: d.uid as string,
    name: (d.name as string) ?? "Member",
    email: (d.email as string) ?? "",
    userType: (d.userType as UserType) ?? "MEMBER",
    teamLeadId: d.teamLeadId as string,
    teamLeadName: d.teamLeadName as string | undefined,
    teamName: (d.teamName as string) ?? "Team",
    joinedAt: toDate(d.joinedAt),
    prefs: d.prefs as Partial<NotificationPrefs> | undefined,
  };
}

/** Teams the user belongs to (live). */
export function subscribeMyMemberships(uid: string, cb: (m: Membership[]) => void, onError: (e: unknown) => void) {
  return onSnapshot(
    query(collection(db, "team_members"), where("uid", "==", uid)),
    (snap) => cb(snap.docs.map((d) => mapMembership(d.id, d.data()))),
    (e) => {
      logError("teams", "memberships listener failed", e);
      onError(e);
    },
  );
}

export function subscribeRoster(teamId: string, cb: (m: Membership[]) => void, onError: (e: unknown) => void) {
  return onSnapshot(
    query(collection(db, "team_members"), where("teamLeadId", "==", teamId)),
    (snap) =>
      cb(
        snap.docs
          .map((d) => mapMembership(d.id, d.data()))
          .sort((a, b) => (a.userType === b.userType ? a.name.localeCompare(b.name) : a.userType === "TEAM_LEAD" ? -1 : 1)),
      ),
    (e) => {
      logError("teams", "roster listener failed", e, { teamId });
      onError(e);
    },
  );
}

export interface Invite {
  code: string;
  teamName: string;
  isActive: boolean;
}

export function subscribeActiveInvite(leadUid: string, cb: (invite: Invite | null) => void, onError: (e: unknown) => void) {
  return onSnapshot(
    query(collection(db, "team_invites"), where("teamLeadId", "==", leadUid), where("isActive", "==", true)),
    (snap) => {
      const d = snap.docs[0]?.data();
      cb(d ? { code: d.code as string, teamName: d.teamName as string, isActive: true } : null);
    },
    onError,
  );
}

const inviteDoc = (code: string, lead: Profile, teamName: string) => ({
  code,
  teamName,
  teamLeadId: lead.uid,
  teamLeadName: lead.name,
  teamLeadEmail: lead.email,
  createdAt: serverTimestamp(),
  isActive: true,
});

/** Create the lead's team: an invite (id = code) and the lead's membership, atomically. */
export async function createTeam(lead: Profile, teamName: string): Promise<string> {
  const name = teamName.trim();
  if (!name) throw new Error("Team name is required");
  const code = randomCode(8);
  const batch = writeBatch(db);
  batch.set(doc(db, "team_invites", code), inviteDoc(code, lead, name));
  batch.set(doc(db, "team_members", membershipId(lead.uid, lead.uid)), {
    uid: lead.uid,
    name: lead.name,
    email: lead.email,
    userType: "TEAM_LEAD",
    teamLeadId: lead.uid,
    teamLeadName: lead.name,
    teamLeadEmail: lead.email,
    teamName: name,
    joinedAt: serverTimestamp(),
  });
  await batch.commit();
  return code;
}

/** Deactivate the current code and issue a fresh one. */
export async function regenerateInvite(lead: Profile, teamName: string, oldCode?: string): Promise<string> {
  const code = randomCode(8);
  const batch = writeBatch(db);
  if (oldCode) batch.update(doc(db, "team_invites", oldCode), { isActive: false });
  batch.set(doc(db, "team_invites", code), inviteDoc(code, lead, teamName));
  await batch.commit();
  return code;
}

export class JoinError extends Error {
  constructor(public reason: "invalid" | "already-member" | "own-team", message: string) {
    super(message);
  }
}

export async function joinTeam(user: Profile, rawCode: string): Promise<Membership> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(code)) throw new JoinError("invalid", "Enter the invite code exactly as your team lead shared it.");

  const inviteSnap = await getDoc(doc(db, "team_invites", code));
  const invite = inviteSnap.exists() ? inviteSnap.data() : null;
  if (!invite || invite.isActive !== true) {
    throw new JoinError("invalid", "That invite code is invalid or has expired.");
  }
  const teamId = invite.teamLeadId as string;
  if (teamId === user.uid) throw new JoinError("own-team", "That's your own team's code.");

  const existing = await getDocs(query(collection(db, "team_members"), where("uid", "==", user.uid), where("teamLeadId", "==", teamId)));
  if (!existing.empty) throw new JoinError("already-member", "You're already a member of this team.");

  const id = membershipId(teamId, user.uid);
  const data = {
    uid: user.uid,
    name: user.name,
    email: user.email,
    userType: "MEMBER" as const,
    teamLeadId: teamId,
    teamLeadName: invite.teamLeadName as string,
    teamLeadEmail: invite.teamLeadEmail as string,
    teamName: invite.teamName as string,
    inviteCode: code,
    joinedAt: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(doc(db, "team_members", id), data);
  await batch.commit();

  // Best effort: tell the lead. Needs the membership to exist first, so it is a separate write.
  void notifyTeammates(
    [{ id: "", uid: teamId, name: "", email: "", userType: "TEAM_LEAD", teamLeadId: teamId, teamName: "" }],
    {
      dedupeKey: `${teamId}-${user.uid}`,
      type: "member_joined",
      teamId,
      actor: { uid: user.uid, name: user.name },
      title: `${user.name} joined ${invite.teamName}`,
      target: { kind: "team", id: teamId },
      groupKey: `joined:${teamId}`,
    },
  );
  return mapMembership(id, { ...data, joinedAt: new Date() });
}

export const removeMember = (teamId: string, uid: string) => deleteDoc(doc(db, "team_members", membershipId(teamId, uid)));
export const leaveTeam = removeMember;

export const updatePrefs = (teamId: string, uid: string, prefs: NotificationPrefs) =>
  updateDoc(doc(db, "team_members", membershipId(teamId, uid)), { prefs });
