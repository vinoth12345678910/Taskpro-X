"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { fetchOlder, listenLatest } from "@/lib/chat";
import { subscribeEvents } from "@/lib/eventsService";
import { logError } from "@/lib/logger";
import { resilient } from "@/lib/resilient";
import { startHeartbeat, subscribePresence } from "@/lib/presence";
import { subscribeResources } from "@/lib/resources";
import { subscribeActiveInvite, subscribeRoster, type Invite } from "@/lib/teams";
import type { ChatMessage, Membership, Presence, Profile, TeamEvent, TeamResource } from "@/lib/types";

export type LoadState = "loading" | "ready" | "error";

interface TeamCtx {
  teamId: string;
  teamName: string;
  me: Profile;
  isLead: boolean;
  online: boolean;
  roster: Membership[];
  rosterState: LoadState;
  presence: Record<string, Presence>;
  invite: Invite | null;
  events: TeamEvent[];
  eventsState: LoadState;
  resources: TeamResource[];
  resourcesState: LoadState;
  messages: ChatMessage[];
  messagesState: LoadState;
  hasMoreMessages: boolean;
  loadingOlder: boolean;
  loadOlder: () => Promise<void>;
  unreadCount: number;
  markChatRead: () => void;
  retry: () => void;
}

const Ctx = createContext<TeamCtx | null>(null);
export function useTeam(): TeamCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTeam must be used inside <TeamProvider>");
  return v;
}

const readKey = (uid: string, teamId: string) => `tpx-read:${uid}:${teamId}`;
const sortKey = (m: ChatMessage) => m.timestamp?.getTime() ?? Number.MAX_SAFE_INTEGER;

export function TeamProvider({ teamId, children }: { teamId: string; children: ReactNode }) {
  const { profile, memberships } = useAuth();
  const me = profile!;
  const membership = memberships.find((m) => m.teamLeadId === teamId);
  const teamName = membership?.teamName ?? "Team";
  const isLead = teamId === me.uid;

  const [attempt, setAttempt] = useState(0); // bump to re-subscribe after an error
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const [roster, setRoster] = useState<Membership[]>([]);
  const [rosterState, setRosterState] = useState<LoadState>("loading");
  const [invite, setInvite] = useState<Invite | null>(null);
  const [presence, setPresence] = useState<Record<string, Presence>>({});
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [eventsState, setEventsState] = useState<LoadState>("loading");
  const [resources, setResources] = useState<TeamResource[]>([]);
  const [resourcesState, setResourcesState] = useState<LoadState>("loading");

  useEffect(() => {
    setRosterState("loading");
    return resilient<Membership[]>((ok, err) => subscribeRoster(teamId, ok, err), (r) => { setRoster(r); setRosterState("ready"); }, () => setRosterState("error"), { scope: "roster" });
  }, [teamId, attempt]);

  useEffect(() => {
    if (!isLead) return;
    return resilient<Invite | null>((ok, err) => subscribeActiveInvite(teamId, ok, err), setInvite, (e) => logError("teams", "invite listener failed", e), { scope: "invite" });
  }, [teamId, isLead, attempt]);

  useEffect(() => subscribePresence(teamId, setPresence), [teamId]);
  useEffect(() => startHeartbeat(teamId, me.uid), [teamId, me.uid]);

  useEffect(() => {
    setEventsState("loading");
    return resilient<TeamEvent[]>((ok, err) => subscribeEvents(teamId, ok, err), (e) => { setEvents(e); setEventsState("ready"); }, () => setEventsState("error"), { scope: "events" });
  }, [teamId, attempt]);

  useEffect(() => {
    setResourcesState("loading");
    return resilient<TeamResource[]>((ok, err) => subscribeResources(teamId, ok, err), (r) => { setResources(r); setResourcesState("ready"); }, () => setResourcesState("error"), { scope: "resources" });
  }, [teamId, attempt]);

  // ---- messages: live newest window + manually paged history ----
  const [msgMap, setMsgMap] = useState<Map<string, ChatMessage>>(new Map());
  const [messagesState, setMessagesState] = useState<LoadState>("loading");
  const [hasMoreMessages, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  useEffect(() => {
    setMessagesState("loading");
    setMsgMap(new Map());
    return resilient<{ changed: ChatMessage[]; first: boolean }>(
      (ok, err) => listenLatest(teamId, (changed, first) => ok({ changed, first }), err),
      ({ changed, first }) => {
        setMsgMap((prev) => {
          const next = new Map(prev);
          for (const m of changed) next.set(m.id, m);
          return next;
        });
        if (first) {
          setHasMore(changed.length >= 40);
          setMessagesState("ready");
        }
      },
      () => setMessagesState("error"),
      { scope: "messages" },
    );
  }, [teamId, attempt]);

  const messages = useMemo(() => [...msgMap.values()].sort((a, b) => sortKey(a) - sortKey(b)), [msgMap]);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const loadOlder = useCallback(async () => {
    const oldest = messagesRef.current.find((m) => m.timestamp);
    if (!oldest?.timestamp || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const { messages: older, hasMore } = await fetchOlder(teamId, oldest.timestamp);
      setMsgMap((prev) => {
        const next = new Map(prev);
        for (const m of older) if (!next.has(m.id)) next.set(m.id, m);
        return next;
      });
      setHasMore(hasMore);
    } catch (e) {
      logError("chat", "loading older messages failed", e, { teamId });
    } finally {
      setLoadingOlder(false);
    }
  }, [teamId, loadingOlder]);

  // ---- unread (per device) ----
  const [lastRead, setLastRead] = useState(0);
  useEffect(() => {
    try {
      setLastRead(Number(localStorage.getItem(readKey(me.uid, teamId))) || 0);
    } catch {
      setLastRead(0);
    }
  }, [me.uid, teamId]);

  const unreadCount = useMemo(
    () => messages.filter((m) => m.timestamp && m.timestamp.getTime() > lastRead && m.author?.uid !== me.uid && !m.deleted).length,
    [messages, lastRead, me.uid],
  );
  const markChatRead = useCallback(() => {
    const newest = messagesRef.current[messagesRef.current.length - 1]?.timestamp?.getTime();
    if (!newest) return;
    setLastRead((cur) => {
      if (newest <= cur) return cur;
      try {
        localStorage.setItem(readKey(me.uid, teamId), String(newest));
      } catch {}
      return newest;
    });
  }, [me.uid, teamId]);

  const value: TeamCtx = {
    teamId,
    teamName,
    me,
    isLead,
    online,
    roster,
    rosterState,
    presence,
    invite,
    events,
    eventsState,
    resources,
    resourcesState,
    messages,
    messagesState,
    hasMoreMessages,
    loadingOlder,
    loadOlder,
    unreadCount,
    markChatRead,
    retry,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
