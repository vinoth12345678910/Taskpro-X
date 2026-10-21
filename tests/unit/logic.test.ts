import { describe, expect, it, vi } from "vitest";
import { extractMentions, segmentMentions } from "@/lib/mentions";
import { redact, log, setErrorReporter } from "@/lib/logger";
import { notificationDocId, wantsNotification, groupNotifications } from "@/lib/notifications";
import { safeFileName, validateFile, validateLink, MAX_FILE_BYTES } from "@/lib/resources";
import { eventSummary } from "@/lib/eventsService";
import { isOnline } from "@/lib/presence";
import { summarizeReactions } from "@/lib/chat";
import type { AppNotification } from "@/lib/types";

const people = [
  { uid: "u1", name: "Ann" },
  { uid: "u2", name: "Ann Lee" },
  { uid: "u3", name: "Bob" },
];

describe("mentions", () => {
  it("matches the longest name first and ignores the author", () => {
    expect(extractMentions("hi @Ann Lee and @bob!", people)).toEqual(["u2", "u3"]);
    expect(extractMentions("ping @Ann", people)).toEqual(["u1"]);
    expect(extractMentions("note to self @Bob", people, "u3")).toEqual([]);
  });
  it("does not match e-mail addresses or partial names", () => {
    expect(extractMentions("mail me at x@Bob.com or @Bobby", people)).toEqual([]);
  });
  it("segments text for rendering", () => {
    expect(segmentMentions("hey @Bob, ok?", people)).toEqual([
      { text: "hey ", mention: false },
      { text: "@Bob", mention: true },
      { text: ", ok?", mention: false },
    ]);
  });
});

describe("logger", () => {
  it("redacts secret-looking keys and message bodies but keeps ids and codes", () => {
    expect(redact({ password: "x", idToken: "y", text: "private", teamId: "t1", code: "permission-denied" })).toEqual({
      password: "[redacted]",
      idToken: "[redacted]",
      text: "[redacted]",
      teamId: "t1",
      code: "permission-denied",
    });
  });
  it("forwards warnings/errors to the reporter hook and survives a throwing reporter", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const rep = vi.fn(() => {
      throw new Error("boom");
    });
    setErrorReporter(rep);
    expect(() => log("warn", "t", "m", { password: "p" })).not.toThrow();
    expect(rep).toHaveBeenCalledWith(expect.objectContaining({ ctx: { password: "[redacted]" } }));
    setErrorReporter(null);
    spy.mockRestore();
  });
});

const n = (id: string, over: Partial<AppNotification> = {}): AppNotification => ({
  id,
  recipientId: "me",
  teamId: "t",
  type: "reply",
  actor: { uid: "a", name: "A" },
  title: id,
  body: "",
  target: { kind: "message", id: "m" },
  groupKey: "reply:m",
  read: false,
  createdAt: new Date(Number(id.replace(/\D/g, "")) * 1000),
  ...over,
});

describe("notifications", () => {
  it("builds deterministic, path-safe ids so retries cannot duplicate", () => {
    expect(notificationDocId("mention", "msg1", "uid9")).toBe("mention_msg1_uid9");
    expect(notificationDocId("event_updated", "e/1", "u")).toBe("event_updated_e-1_u");
  });
  it("respects preferences, defaulting to on", () => {
    expect(wantsNotification({}, "mention")).toBe(true);
    expect(wantsNotification({ prefs: { events: false } }, "event_created")).toBe(false);
    expect(wantsNotification({ prefs: { events: false } }, "mention")).toBe(true);
  });
  it("groups related notifications, counts unread and sorts newest group first", () => {
    const groups = groupNotifications([
      n("n3"),
      n("n2", { read: true }),
      n("n1"),
      n("n5", { type: "mention", groupKey: "mention:x" }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["mention:mention:x", "reply:reply:m"]);
    const reply = groups[1];
    expect(reply.items.map((i) => i.id)).toEqual(["n3", "n2", "n1"]);
    expect(reply.unread).toBe(2);
    expect(reply.latest.id).toBe("n3");
  });
});

describe("resources", () => {
  it("validates files by size and allow-listed type", () => {
    expect(validateFile({ name: "a.pdf", size: 10, type: "application/pdf" })).toBeNull();
    expect(validateFile({ name: "a.pdf", size: MAX_FILE_BYTES + 1, type: "application/pdf" })).toMatch(/at most/);
    expect(validateFile({ name: "x.svg", size: 10, type: "image/svg+xml" })).toMatch(/isn't supported/);
    expect(validateFile({ name: "x.html", size: 10, type: "text/html" })).toMatch(/isn't supported/);
    expect(validateFile({ name: "x", size: 0, type: "text/plain" })).toMatch(/empty/);
  });
  it("accepts only http(s) links", () => {
    expect(validateLink("https://example.com/a b")).toMatchObject({ ok: true });
    expect(validateLink("javascript:alert(1)")).toMatchObject({ ok: false });
    expect(validateLink("not a url")).toMatchObject({ ok: false });
  });
  it("sanitises file names for storage paths", () => {
    expect(safeFileName("../../etc/pass wd?.pdf")).not.toMatch(/[\/\\?]/);
    expect(safeFileName("???")).toBe("_");
  });
});

describe("presence and reactions", () => {
  it("treats stale heartbeats as offline", () => {
    const now = Date.now();
    expect(isOnline({ uid: "a", status: "online", lastSeen: new Date(now - 30_000) }, now)).toBe(true);
    expect(isOnline({ uid: "a", status: "online", lastSeen: new Date(now - 10 * 60_000) }, now)).toBe(false);
    expect(isOnline(undefined, now)).toBe(false);
  });
  it("summarises per-user reactions into per-emoji voters", () => {
    const s = summarizeReactions({ a: ["up", "check"], b: ["up"] });
    expect(s.get("up")).toEqual(["a", "b"]);
    expect(s.get("check")).toEqual(["a"]);
  });
});

describe("event notification text", () => {
  it("formats the start time in the event's zone without throwing (Intl rejects dateStyle + timeZoneName)", () => {
    const startAt = new Date("2027-03-03T03:30:00.000Z");
    expect(eventSummary({ startAt, timeZone: "Asia/Kolkata" })).toBe("Mar 3, 2027, 9:00 AM GMT+5:30");
    expect(eventSummary({ startAt, timeZone: "America/New_York" })).toBe("Mar 2, 2027, 10:30 PM EST");
  });
});
