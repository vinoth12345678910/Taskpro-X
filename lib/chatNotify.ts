import { notifyTeammates } from "./notifications";
import type { Membership } from "./types";

const snippet = (t: string) => (t.length > 140 ? `${t.slice(0, 137)}…` : t);

/** Mentions (and, for replies, a notice to the parent's author) — best effort, never throws. */
export async function notifyForMessage(args: {
  teamId: string;
  roster: Membership[];
  actor: { uid: string; name: string };
  messageId: string;
  text: string;
  mentions: string[];
  parent?: { id: string; authorUid?: string };
}) {
  const { teamId, roster, actor, messageId, text, mentions, parent } = args;
  const target = { kind: "message" as const, id: parent?.id ?? messageId, ...(parent ? { parentId: parent.id } : {}) };
  const mentioned = roster.filter((r) => mentions.includes(r.uid));
  await notifyTeammates(mentioned, {
    dedupeKey: messageId,
    type: "mention",
    teamId,
    actor,
    title: `${actor.name} mentioned you`,
    body: snippet(text),
    target,
    groupKey: `mention:${target.id}`,
  });

  if (parent?.authorUid && !mentions.includes(parent.authorUid)) {
    const author = roster.filter((r) => r.uid === parent.authorUid);
    await notifyTeammates(author, {
      dedupeKey: messageId,
      type: "reply",
      teamId,
      actor,
      title: `${actor.name} replied to your message`,
      body: snippet(text),
      target,
      groupKey: `reply:${parent.id}`,
    });
  }
}
