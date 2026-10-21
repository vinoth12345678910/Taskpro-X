"use client";
import { Copy, MessageSquareReply, MoreHorizontal, Pencil, SmilePlus, Trash2 } from "lucide-react";
import { m } from "motion/react";
import { useMemo, useState } from "react";
import { useToast } from "@/components/providers/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Menu, MenuItem, Popover, PopoverClose } from "@/components/ui/Menu";
import { Avatar, Badge } from "@/components/ui/misc";
import { cn } from "@/components/ui/cn";
import { deleteMessage, editMessage, summarizeReactions, toggleReaction } from "@/lib/chat";
import { friendlyError } from "@/lib/firestore-utils";
import { extractMentions, segmentMentions } from "@/lib/mentions";
import { REACTIONS, type ChatMessage, type Membership } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";

interface Props {
  message: ChatMessage;
  roster: Membership[];
  rosterReady: boolean;
  meUid: string;
  isLead: boolean;
  /** Hide the author line when the previous message is by the same person moments earlier */
  compact?: boolean;
  /** Animate in (only for messages that arrive after the first load) */
  fresh?: boolean;
  onOpenThread?: (m: ChatMessage) => void;
  /** Rendering inside the thread panel header: no reply affordance */
  inThread?: boolean;
  onEdited?: (m: ChatMessage, text: string, mentions: string[]) => void;
}

export const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const fullFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" });

export function MessageItem({ message: msg, roster, rosterReady, meUid, isLead, compact, fresh, onOpenThread, inThread, onEdited }: Props) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.text);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tapOpen, setTapOpen] = useState(false); // touch devices: tap a message to reveal its actions

  const mine = msg.author?.uid === meUid;
  const canEdit = mine && !msg.deleted;
  const canDelete = (mine || isLead) && !msg.deleted;
  const formerMember = rosterReady && !!msg.author && !roster.some((r) => r.uid === msg.author.uid);
  const people = useMemo(() => roster.map((r) => ({ uid: r.uid, name: r.name })), [roster]);
  const names = useMemo(() => new Map(roster.map((r) => [r.uid, r.name])), [roster]);
  const reactions = summarizeReactions(msg.reactions);
  const when = msg.timestamp;

  async function react(code: string) {
    setPickerOpen(false);
    try {
      await toggleReaction(msg, meUid, code, msg.reactions[meUid] ?? []);
    } catch (e) {
      toast({ tone: "error", title: "Couldn't update reaction", description: friendlyError(e) });
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(msg.text);
      toast({ tone: "success", title: "Message copied" });
    } catch {
      toast({ tone: "error", title: "Couldn't copy", description: "Your browser blocked clipboard access." });
    }
  }

  async function save() {
    const text = draft.trim();
    if (!text || text === msg.text) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const mentions = extractMentions(text, people, meUid);
      await editMessage(msg, text, mentions);
      onEdited?.(msg, text, mentions);
      setEditing(false);
    } catch (e) {
      toast({ tone: "error", title: "Couldn't save your edit", description: friendlyError(e) });
    } finally {
      setSaving(false);
    }
  }

  const body = msg.deleted ? (
    <p className="italic text-ink-3">This message was deleted.</p>
  ) : editing ? (
    <div className="space-y-2">
      <label className="sr-only" htmlFor={`edit-${msg.id}`}>Edit message</label>
      <Textarea
        id={`edit-${msg.id}`}
        autoFocus
        rows={2}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setEditing(false); setDraft(msg.text); }
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void save(); }
        }}
      />
      <div className="flex gap-2">
        <Button size="sm" variant="primary" loading={saving} onClick={() => void save()}>Save</Button>
        <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(msg.text); }}>Cancel</Button>
      </div>
    </div>
  ) : (
    <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
      {segmentMentions(msg.text, people).map((s, i) =>
        s.mention ? (
          <span key={i} className="rounded-sm bg-accent-soft px-0.5 font-medium text-accent-text">
            {s.text}
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
      {msg.editedAt && <span className="ml-1.5 text-caption text-ink-3">(edited)</span>}
    </p>
  );

  return (
    <m.article
      initial={fresh ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
      aria-label={`${msg.author?.name ?? "Unknown"}${when ? `, ${timeFmt.format(when)}` : ""}`}
      id={inThread ? undefined : `msg-${msg.id}`}
      onClick={(e) => {
        if (!window.matchMedia("(hover: none)").matches) return;
        if ((e.target as HTMLElement).closest("button, a, textarea, [role=toolbar]")) return;
        setTapOpen((o) => !o);
      }}
      className={cn(
        "group relative flex gap-3 rounded-md px-3 py-1 hover:bg-surface-2/60 focus-within:bg-surface-2/60",
        compact ? "pt-0" : "pt-2",
        msg.pending && "opacity-70",
      )}
    >
      <div className="w-8 shrink-0">
        {!compact && <Avatar name={msg.author?.name ?? "?"} lead={msg.author?.userType === "TEAM_LEAD"} self={mine} />}
        {compact && when && (
          <time dateTime={when.toISOString()} className="invisible block pt-1 text-right text-[10px] text-ink-3 group-hover:visible">
            {timeFmt.format(when)}
          </time>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {!compact && (
          <header className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-body font-semibold">{msg.author?.name ?? "Unknown"}</span>
            {msg.author?.userType === "TEAM_LEAD" && <Badge tone="accent">Lead</Badge>}
            {formerMember && <Badge>Former member</Badge>}
            {when && (
              <time dateTime={when.toISOString()} title={fullFmt.format(when)} className="text-caption text-ink-3">
                {timeFmt.format(when)}
              </time>
            )}
            {msg.pending && <span className="text-caption text-ink-3">Sending…</span>}
          </header>
        )}
        <div className="text-body text-ink">{body}</div>

        {!msg.deleted && reactions.size > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {REACTIONS.filter((r) => reactions.has(r.code)).map((r) => {
              const voters = reactions.get(r.code)!;
              const iReacted = voters.includes(meUid);
              const who = voters.map((u) => (u === meUid ? "You" : names.get(u) ?? "Former member")).join(", ");
              return (
                <button
                  key={r.code}
                  onClick={() => void react(r.code)}
                  aria-pressed={iReacted}
                  aria-label={`${r.label}: ${who}`}
                  title={who}
                  className={cn(
                    "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-caption transition-colors",
                    iReacted ? "border-accent bg-accent-soft text-accent-text" : "border-line-strong bg-surface hover:bg-surface-2",
                  )}
                >
                  <span aria-hidden="true">{r.glyph}</span>
                  {voters.length}
                </button>
              );
            })}
          </div>
        )}

        {!inThread && !msg.deleted && msg.replyCount > 0 && (
          <button
            onClick={() => onOpenThread?.(msg)}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-caption font-medium text-accent-text hover:bg-accent-soft"
          >
            <MessageSquareReply size={14} aria-hidden="true" />
            {msg.replyCount} {msg.replyCount === 1 ? "reply" : "replies"}
            {msg.lastReplyAt && <span className="font-normal text-ink-3">· last {timeFmt.format(msg.lastReplyAt)}</span>}
          </button>
        )}
        {!inThread && msg.deleted && msg.replyCount > 0 && (
          <button onClick={() => onOpenThread?.(msg)} className="mt-1 text-caption font-medium text-accent-text hover:underline">
            View {msg.replyCount} {msg.replyCount === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>

      {!msg.deleted && !editing && !msg.pending && (
        <div
          className={cn(
            "absolute -top-3 right-3 flex items-center rounded-md border border-line bg-surface p-0.5 shadow-card transition-opacity focus-within:opacity-100 group-hover:opacity-100",
            // on touch devices the toolbar is shown by tapping the message; while hidden it must not intercept taps
            tapOpen ? "opacity-100" : "opacity-0 [@media(hover:none)]:pointer-events-none",
          )}
          role="toolbar"
          aria-label="Message actions"
        >
          <Popover
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            trigger={
              <button aria-label="Add reaction" className="grid h-7 w-7 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink">
                <SmilePlus size={15} aria-hidden="true" />
              </button>
            }
          >
            <div className="flex gap-0.5 p-1.5" role="group" aria-label="Choose a reaction">
              {REACTIONS.map((r) => (
                <PopoverClose asChild key={r.code}>
                  <button
                    onClick={() => void react(r.code)}
                    aria-label={r.label}
                    aria-pressed={(msg.reactions[meUid] ?? []).includes(r.code)}
                    className="grid h-8 w-8 place-items-center rounded text-lg hover:bg-surface-2 aria-pressed:bg-accent-soft"
                  >
                    <span aria-hidden="true">{r.glyph}</span>
                  </button>
                </PopoverClose>
              ))}
            </div>
          </Popover>
          {!inThread && (
            <button
              onClick={() => onOpenThread?.(msg)}
              aria-label="Reply in thread"
              className="grid h-7 w-7 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              <MessageSquareReply size={15} aria-hidden="true" />
            </button>
          )}
          <Menu
            trigger={
              <button aria-label="More actions" className="grid h-7 w-7 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink">
                <MoreHorizontal size={15} aria-hidden="true" />
              </button>
            }
          >
            <MenuItem onSelect={() => void copy()}>
              <Copy size={15} aria-hidden="true" /> Copy text
            </MenuItem>
            {canEdit && (
              <MenuItem onSelect={() => { setDraft(msg.text); setEditing(true); }}>
                <Pencil size={15} aria-hidden="true" /> Edit
              </MenuItem>
            )}
            {canDelete && (
              <MenuItem danger onSelect={() => setConfirmDelete(true)}>
                <Trash2 size={15} aria-hidden="true" /> Delete
              </MenuItem>
            )}
          </Menu>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this message?"
        description={msg.replyCount > 0 ? "The message text is removed. Its replies stay visible in the thread." : "This removes the message text for everyone in the team."}
        confirmLabel="Delete message"
        onConfirm={async () => {
          try {
            await deleteMessage(msg);
          } catch (e) {
            toast({ tone: "error", title: "Couldn't delete the message", description: friendlyError(e) });
          }
        }}
      />
    </m.article>
  );
}
