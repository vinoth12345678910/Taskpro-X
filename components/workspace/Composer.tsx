"use client";
import { Send } from "lucide-react";
import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { MAX_MESSAGE_LENGTH, newMessageId } from "@/lib/chat";
import { friendlyError } from "@/lib/firestore-utils";
import { extractMentions } from "@/lib/mentions";
import type { Membership } from "@/lib/types";

interface Props {
  roster: Membership[];
  meUid: string;
  placeholder: string;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
  /** Must be idempotent for a given `id` (it is reused on retry). Throw to signal failure. */
  onSend: (args: { id: string; text: string; mentions: string[] }) => Promise<void>;
  autoFocus?: boolean;
  /** Narrow containers (thread panel): shorter hint text */
  compact?: boolean;
}

/**
 * Message composer. A message id is minted when sending starts and kept until it succeeds, so a retry
 * after a failure or a double-submit writes the same document instead of creating a duplicate.
 */
export function Composer({ roster, meUid, placeholder, label, disabled, disabledReason, onSend, autoFocus, compact }: Props) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pendingId = useRef<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const listId = useId();

  // @mention autocomplete
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const options = mention
    ? roster.filter((r) => r.uid !== meUid && r.name.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 6)
    : [];

  const detectMention = useCallback((value: string, caret: number) => {
    const upto = value.slice(0, caret);
    const m = /(^|\s)@([^\s@]{0,30})$/.exec(upto);
    setMention(m ? { start: caret - m[2].length - 1, query: m[2] } : null);
    setActive(0);
  }, []);

  function pick(r: Membership) {
    if (!mention || !ta.current) return;
    const caret = ta.current.selectionStart;
    const next = `${text.slice(0, mention.start)}@${r.name} ${text.slice(caret)}`;
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      const pos = mention.start + r.name.length + 2;
      ta.current?.setSelectionRange(pos, pos);
      ta.current?.focus();
    });
  }

  async function submit() {
    const body = text.trim();
    if (!body || disabled) return;
    if (body.length > MAX_MESSAGE_LENGTH) {
      setError(`Messages can be at most ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }
    // Clear right away so the next message can be typed and sent while this one is still in flight.
    // The id is kept only if sending fails, so "Send" on the restored draft retries the SAME document.
    const id = pendingId.current ?? newMessageId();
    pendingId.current = null;
    setText("");
    setMention(null);
    setError(null);
    if (ta.current) ta.current.style.height = "auto";
    try {
      await onSend({ id, text: body, mentions: extractMentions(body, roster, meUid) });
    } catch (e) {
      setText((cur) => (cur ? cur : body));
      pendingId.current = id;
      setError(`Not sent. ${friendlyError(e, "Check your connection and press Send to retry.")}`);
    } finally {
      ta.current?.focus();
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (mention && options.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % options.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + options.length) % options.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(options[active]); return; }
      if (e.key === "Escape") { e.preventDefault(); setMention(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  }

  const remaining = MAX_MESSAGE_LENGTH - text.length;
  return (
    <div className="relative">
      {mention && options.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Mention a teammate"
          className="absolute bottom-full left-0 z-20 mb-2 w-64 overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-pop"
        >
          {options.map((r, i) => (
            <li
              key={r.uid}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(r); }}
              className={cn("cursor-pointer rounded-md px-2.5 py-1.5 text-body", i === active && "bg-surface-2")}
            >
              <span className="font-medium">{r.name}</span>
              {r.userType === "TEAM_LEAD" && <span className="ml-2 text-caption text-ink-3">Lead</span>}
            </li>
          ))}
        </ul>
      )}
      <div className={cn("rounded-lg border bg-surface transition-colors focus-within:border-ink", error ? "border-danger" : "border-line-strong")}>
        <label htmlFor={`${listId}-ta`} className="sr-only">
          {label}
        </label>
        <textarea
          id={`${listId}-ta`}
          ref={ta}
          rows={1}
          value={text}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={disabled ? disabledReason : placeholder}
          role="combobox"
          aria-expanded={!!mention && options.length > 0}
          aria-controls={mention ? listId : undefined}
          aria-activedescendant={mention && options.length ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          onChange={(e) => {
            setText(e.target.value);
            detectMention(e.target.value, e.target.selectionStart);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
          }}
          onKeyDown={onKeyDown}
          className="block max-h-44 w-full resize-none rounded-lg bg-transparent px-3.5 pb-1 pt-3 text-body text-ink placeholder:text-ink-3 focus-visible:outline-none disabled:cursor-not-allowed"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2 pl-3.5">
          <p className={cn("text-caption", remaining < 200 ? "text-warn" : "text-ink-3")}>
            {remaining < 200 ? `${remaining} characters left` : compact ? "Enter to send" : "Enter to send · Shift+Enter for a new line · @ to mention"}
          </p>
          <Button variant="primary" size="sm" onClick={() => void submit()} disabled={!text.trim() || disabled} aria-label="Send message">
            <Send size={14} aria-hidden="true" /> Send
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-caption font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
