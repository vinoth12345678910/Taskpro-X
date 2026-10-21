"use client";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/misc";
import { listenReplies, sendReply } from "@/lib/chat";
import { notifyForMessage } from "@/lib/chatNotify";
import type { ChatMessage } from "@/lib/types";
import { Composer } from "./Composer";
import { MessageItem } from "./MessageItem";
import { useTeam } from "./TeamContext";

export function ThreadPanel({ parent, onClose }: { parent: ChatMessage; onClose: () => void }) {
  const t = useTeam();
  const [replies, setReplies] = useState<ChatMessage[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setReplies(null);
    setFailed(false);
    return listenReplies(parent.id, setReplies, () => setFailed(true));
  }, [parent.id]);

  // Use the live copy of the parent so reactions / reply count / deletion stay current.
  const live = t.messages.find((m) => m.id === parent.id) ?? parent;

  const send = useCallback(
    async ({ id, text, mentions }: { id: string; text: string; mentions: string[] }) => {
      await sendReply({
        parentId: parent.id,
        id,
        roomId: t.teamId,
        text,
        mentions,
        author: { uid: t.me.uid, name: t.me.name, email: t.me.email, userType: t.isLead ? "TEAM_LEAD" : "MEMBER" },
      });
      void notifyForMessage({
        teamId: t.teamId,
        roster: t.roster,
        actor: { uid: t.me.uid, name: t.me.name },
        messageId: id,
        text,
        mentions,
        parent: { id: parent.id, authorUid: live.author?.uid },
      });
    },
    [parent.id, t.teamId, t.me, t.isLead, t.roster, live.author?.uid],
  );

  return (
    <section aria-label="Thread" className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-title font-semibold">Thread</h2>
        <button onClick={onClose} aria-label="Close thread" className="grid h-8 w-8 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink">
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto py-3">
        <MessageItem message={live} roster={t.roster} rosterReady={t.rosterState === "ready"} meUid={t.me.uid} isLead={t.isLead} inThread />
        <div className="my-2 flex items-center gap-3 px-4">
          <span className="text-caption font-medium text-ink-3">
            {live.replyCount} {live.replyCount === 1 ? "reply" : "replies"}
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>
        {failed && <p role="alert" className="px-4 text-body text-danger">Couldn&apos;t load replies. Check your connection.</p>}
        {!failed && replies === null && (
          <div className="space-y-3 px-4" aria-busy="true">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}
        {replies?.map((r, i) => (
          <MessageItem
            key={r.id}
            message={r}
            roster={t.roster}
            rosterReady={t.rosterState === "ready"}
            meUid={t.me.uid}
            isLead={t.isLead}
            inThread
            compact={i > 0 && replies[i - 1].author?.uid === r.author?.uid}
          />
        ))}
      </div>
      <div className="border-t border-line p-3">
        <Composer
          roster={t.roster}
          meUid={t.me.uid}
          label="Reply in thread"
          placeholder="Reply…"
          onSend={send}
         
        />
      </div>
    </section>
  );
}
