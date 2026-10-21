"use client";
import { ArrowDown, History, MessageSquare, WifiOff } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorState, EmptyState, Skeleton } from "@/components/ui/misc";
import { sendMessage } from "@/lib/chat";
import { notifyForMessage } from "@/lib/chatNotify";
import type { ChatMessage } from "@/lib/types";
import { Composer } from "./Composer";
import { MessageItem } from "./MessageItem";
import { useTeam } from "./TeamContext";

const GROUP_WINDOW_MS = 5 * 60_000;
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });

function dayLabel(d: Date) {
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(d)) / 86400000);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : dayFmt.format(d);
}

export function ChatView({ onOpenThread, active, focusMessageId }: { onOpenThread: (m: ChatMessage) => void; active: boolean; focusMessageId?: string }) {
  const t = useTeam();
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [away, setAway] = useState(0); // messages that arrived while scrolled up
  const seen = useRef<Set<string> | null>(null);
  const lastCount = useRef(0);

  const topLevel = t.messages;

  // Track which messages existed at first paint so only later arrivals animate in.
  const fresh = useMemo(() => {
    if (t.messagesState !== "ready") return new Set<string>();
    if (!seen.current) {
      seen.current = new Set(topLevel.map((m) => m.id));
      return new Set<string>();
    }
    const f = new Set<string>();
    for (const m of topLevel) if (!seen.current.has(m.id)) f.add(m.id);
    return f;
  }, [topLevel, t.messagesState]);
  useEffect(() => {
    topLevel.forEach((m) => seen.current?.add(m.id));
  }, [topLevel]);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stick.current = near;
    if (near) {
      setAway(0);
      if (active) t.markChatRead();
    }
  }, [active, t]);

  const scrollToEnd = useCallback((smooth = false) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Keep pinned to the newest message unless the reader scrolled up; otherwise count what they are missing.
  useLayoutEffect(() => {
    const added = topLevel.length - lastCount.current;
    lastCount.current = topLevel.length;
    if (t.messagesState !== "ready") return;
    if (stick.current) {
      scrollToEnd();
      if (active) t.markChatRead();
    } else if (added > 0 && topLevel[topLevel.length - 1]?.author?.uid !== t.me.uid) {
      setAway((n) => n + added);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topLevel, t.messagesState]);

  useEffect(() => {
    if (active && stick.current) t.markChatRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Preserve scroll position when older history is prepended.
  const prevHeight = useRef(0);
  const loadOlder = async () => {
    prevHeight.current = scroller.current?.scrollHeight ?? 0;
    await t.loadOlder();
    requestAnimationFrame(() => {
      const el = scroller.current;
      if (el) el.scrollTop += el.scrollHeight - prevHeight.current;
    });
  };

  useEffect(() => {
    if (!focusMessageId) return;
    document.getElementById(`msg-${focusMessageId}`)?.scrollIntoView({ block: "center" });
  }, [focusMessageId, t.messagesState]);

  const send = useCallback(
    async ({ id, text, mentions }: { id: string; text: string; mentions: string[] }) => {
      await sendMessage({
        id,
        roomId: t.teamId,
        text,
        mentions,
        author: { uid: t.me.uid, name: t.me.name, email: t.me.email, userType: t.isLead ? "TEAM_LEAD" : "MEMBER" },
      });
      stick.current = true;
      if (mentions.length) void notifyForMessage({ teamId: t.teamId, roster: t.roster, actor: { uid: t.me.uid, name: t.me.name }, messageId: id, text, mentions });
    },
    [t.teamId, t.me, t.isLead, t.roster],
  );

  let lastDay = "";
  return (
    <div className="flex h-full min-h-0 flex-col">
      {!t.online && (
        <div role="status" className="flex items-center gap-2 border-b border-line bg-warn-soft px-4 py-2 text-caption font-medium text-warn">
          <WifiOff size={14} aria-hidden="true" /> You&apos;re offline. Messages you send are kept and will be delivered when you reconnect.
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        <div ref={scroller} onScroll={onScroll} role="log" aria-label={`${t.teamName} conversation`} className="h-full overflow-y-auto px-2 py-4 sm:px-4">
          {t.messagesState === "loading" && (
            <div className="space-y-5 px-3" aria-busy="true" aria-label="Loading messages">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3.5 w-[70%]" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {t.messagesState === "error" && (
            <ErrorState title="Couldn't load the conversation" onRetry={t.retry}>
              Check your connection. If this keeps happening, you may no longer be a member of this team.
            </ErrorState>
          )}
          {t.messagesState === "ready" && (
            <>
              {t.hasMoreMessages && (
                <div className="mb-3 flex justify-center">
                  <Button size="sm" variant="secondary" onClick={() => void loadOlder()} loading={t.loadingOlder}>
                    <History size={14} aria-hidden="true" /> Load earlier messages
                  </Button>
                </div>
              )}
              {topLevel.length === 0 ? (
                <EmptyState icon={<MessageSquare size={22} />} title={`Start the conversation in ${t.teamName}`}>
                  Messages here are visible to everyone on the team. Use @ to mention someone and reply in threads to keep topics tidy.
                </EmptyState>
              ) : (
                topLevel.map((m, i) => {
                  const prev = topLevel[i - 1];
                  const when = m.timestamp ?? new Date();
                  const key = when.toDateString();
                  const sep = key !== lastDay;
                  lastDay = key;
                  const compact =
                    !sep && !!prev && prev.author?.uid === m.author?.uid && !prev.deleted && !!prev.timestamp && !!m.timestamp && m.timestamp.getTime() - prev.timestamp.getTime() < GROUP_WINDOW_MS;
                  return (
                    <div key={m.id}>
                      {sep && (
                        <div className="my-3 flex items-center gap-3 px-3" role="separator" aria-label={dayLabel(when)}>
                          <span className="h-px flex-1 bg-line" />
                          <span className="text-caption font-medium text-ink-3">{dayLabel(when)}</span>
                          <span className="h-px flex-1 bg-line" />
                        </div>
                      )}
                      <MessageItem
                        message={m}
                        roster={t.roster}
                        rosterReady={t.rosterState === "ready"}
                        meUid={t.me.uid}
                        isLead={t.isLead}
                        compact={compact}
                        fresh={fresh.has(m.id)}
                        onOpenThread={onOpenThread}
                      />
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
        {away > 0 && (
          <button
            onClick={() => { scrollToEnd(true); setAway(0); stick.current = true; }}
            className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-caption font-medium text-paper shadow-pop"
          >
            <ArrowDown size={14} aria-hidden="true" /> {away} new {away === 1 ? "message" : "messages"}
          </button>
        )}
      </div>
      <div className="border-t border-line bg-paper px-3 pb-3 pt-3 sm:px-5">
        <Composer
          roster={t.roster}
          meUid={t.me.uid}
          label={`Message ${t.teamName}`}
          placeholder={`Message ${t.teamName}`}
          onSend={send}
          disabled={t.messagesState === "error"}
          disabledReason="Messaging is unavailable right now"
        />
      </div>
    </div>
  );
}
