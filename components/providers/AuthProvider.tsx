"use client";
import { onAuthStateChanged, signOut as fbSignOut, type User } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { auth, db } from "@/lib/firebase";
import { logError } from "@/lib/logger";
import { resilient } from "@/lib/resilient";
import { subscribeMyMemberships } from "@/lib/teams";
import type { Membership, Profile, Role } from "@/lib/types";

type Status = "loading" | "signed-out" | "profile-missing" | "ready";

interface AuthState {
  status: Status;
  user: User | null;
  profile: Profile | null;
  memberships: Membership[];
  membershipsReady: boolean;
  membershipError: boolean;
  activeTeamId: string | null;
  activeMembership: Membership | null;
  setActiveTeamId: (id: string) => void;
  /** Create a default member profile for an account that has none (recovery path). */
  repairProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);
export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}

export const homeFor = (role: Role | undefined) =>
  role === "admin" ? "/admin-dashboard" : role === "team_lead" ? "/teamlead-dashboard" : "/member-dashboard";

const teamKey = (uid: string) => `tpx-team:${uid}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [membershipsReady, setMembershipsReady] = useState(false);
  const [membershipError, setMembershipError] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setAuthReady(true); }), []);

  // Profile (live, so a signup that writes the document a moment after account creation is picked up)
  useEffect(() => {
    setProfile(null);
    setProfileMissing(false);
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      { includeMetadataChanges: true },
      (snap) => {
        // A profile that only exists as a pending local write (e.g. mid-signup) is not trusted yet:
        // wait for the server to confirm it, otherwise a failed/aborted write would look like success.
        if (snap.metadata.hasPendingWrites) return;
        if (snap.exists()) {
          clearTimeout(timer);
          setProfileMissing(false);
          const d = snap.data();
          const role: Role = d.role === "admin" || d.role === "team_lead" ? d.role : "member";
          setProfile({
            uid: user.uid,
            role,
            name: (d.name as string) || user.displayName || user.email?.split("@")[0] || "Member",
            email: (d.email as string) || user.email || "",
          });
        } else {
          setProfile(null);
          timer = setTimeout(() => setProfileMissing(true), 4000);
        }
      },
      (e) => logError("auth", "profile listener failed", e),
    );
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [user]);

  // Memberships (live)
  useEffect(() => {
    setMemberships([]);
    setMembershipsReady(false);
    setMembershipError(false);
    if (!user) return;
    return resilient<Membership[]>(
      (ok, err) => subscribeMyMemberships(user.uid, ok, err),
      (m) => {
        setMemberships(m);
        setMembershipsReady(true);
      },
      () => {
        setMembershipError(true);
        setMembershipsReady(true);
      },
      { scope: "memberships" },
    );
  }, [user]);

  // Active team = last used, else own team, else first
  useEffect(() => {
    if (!user || !membershipsReady) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(teamKey(user.uid));
    } catch {}
    const pick =
      memberships.find((m) => m.teamLeadId === saved) ?? memberships.find((m) => m.teamLeadId === user.uid) ?? memberships[0] ?? null;
    setTeamId((cur) => (cur && memberships.some((m) => m.teamLeadId === cur) ? cur : pick?.teamLeadId ?? null));
  }, [user, memberships, membershipsReady]);

  const setActiveTeamId = useCallback(
    (id: string) => {
      setTeamId(id);
      if (user) {
        try {
          localStorage.setItem(teamKey(user.uid), id);
        } catch {}
      }
    },
    [user],
  );

  const repairProfile = useCallback(async () => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), {
      name: user.displayName || user.email?.split("@")[0] || "Member",
      email: user.email ?? "",
      role: "member",
      createdAt: serverTimestamp(),
    });
  }, [user]);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
  }, []);

  const status: Status = !authReady ? "loading" : !user ? "signed-out" : profile ? "ready" : profileMissing ? "profile-missing" : "loading";
  const activeMembership = memberships.find((m) => m.teamLeadId === teamId) ?? null;

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      profile,
      memberships,
      membershipsReady,
      membershipError,
      activeTeamId: teamId,
      activeMembership,
      setActiveTeamId,
      repairProfile,
      signOut,
    }),
    [status, user, profile, memberships, membershipsReady, membershipError, teamId, activeMembership, setActiveTeamId, repairProfile, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
