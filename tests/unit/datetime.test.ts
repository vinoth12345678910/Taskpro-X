import { describe, expect, it } from "vitest";
import { dayKey, formatInZone, utcToZonedLocal, zonedLocalToUtc } from "@/lib/datetime";
import { validateEventForm } from "@/lib/events";

const ok = (local: string, tz: string) => {
  const r = zonedLocalToUtc(local, tz);
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return r;
};

describe("zonedLocalToUtc", () => {
  it("interprets wall-clock time in the chosen zone, not the machine zone", () => {
    // Regression for the original bug class: 09:00 in Kolkata is 03:30Z, regardless of where the code runs.
    expect(ok("2026-03-10T09:00", "Asia/Kolkata").date.toISOString()).toBe("2026-03-10T03:30:00.000Z");
    expect(ok("2026-03-10T09:00", "America/New_York").date.toISOString()).toBe("2026-03-10T13:00:00.000Z"); // EDT
    expect(ok("2026-01-10T09:00", "America/New_York").date.toISOString()).toBe("2026-01-10T14:00:00.000Z"); // EST
    expect(ok("2026-06-01T12:00", "UTC").date.toISOString()).toBe("2026-06-01T12:00:00.000Z");
  });

  it("rejects wall-clock times skipped by spring-forward", () => {
    // US 2026: clocks jump 02:00 -> 03:00 on 8 March
    const r = zonedLocalToUtc("2026-03-08T02:30", "America/New_York");
    expect(r).toEqual({ ok: false, reason: "nonexistent" });
    expect(ok("2026-03-08T03:30", "America/New_York").date.toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });

  it("resolves repeated fall-back times to the first occurrence and flags them", () => {
    // US 2026: 01:30 happens twice on 1 November
    const r = ok("2026-11-01T01:30", "America/New_York");
    expect(r.ambiguous).toBe(true);
    expect(r.date.toISOString()).toBe("2026-11-01T05:30:00.000Z"); // EDT occurrence
    expect(ok("2026-11-01T03:30", "America/New_York").ambiguous).toBe(false);
  });

  it("handles half-hour zones, southern hemisphere and zones ahead of UTC across midnight", () => {
    expect(ok("2026-01-01T00:30", "Pacific/Auckland").date.toISOString()).toBe("2025-12-31T11:30:00.000Z");
    expect(ok("2026-07-01T08:00", "Australia/Sydney").date.toISOString()).toBe("2026-06-30T22:00:00.000Z");
  });

  it("rejects malformed input and impossible dates", () => {
    expect(zonedLocalToUtc("2026-02-30T10:00", "UTC")).toEqual({ ok: false, reason: "format" });
    expect(zonedLocalToUtc("2026-02-10 10:00", "UTC")).toEqual({ ok: false, reason: "format" });
    expect(zonedLocalToUtc("2026-02-10T10:00", "Mars/Olympus")).toEqual({ ok: false, reason: "timezone" });
  });

  it("round-trips through utcToZonedLocal", () => {
    for (const tz of ["Asia/Kolkata", "America/Los_Angeles", "Europe/London", "UTC"]) {
      const d = ok("2026-10-25T14:15", tz).date;
      expect(utcToZonedLocal(d, tz)).toBe("2026-10-25T14:15");
    }
  });
});

describe("rendering", () => {
  it("shows an event in the author's zone and groups by that zone's calendar day", () => {
    const d = ok("2026-05-04T23:30", "America/Los_Angeles").date; // 06:30Z next day
    expect(dayKey(d, "America/Los_Angeles")).toBe("2026-05-04");
    expect(dayKey(d, "UTC")).toBe("2026-05-05");
    expect(formatInZone(d, "Asia/Kolkata", { timeStyle: "short" }, "en-US")).toBe("12:00 PM");
  });
});

describe("validateEventForm", () => {
  const base = { title: "Sprint review", description: "", start: "2026-05-04T10:00", end: "2026-05-04T11:00", timeZone: "UTC" };

  it("accepts a valid event and returns UTC instants", () => {
    const v = validateEventForm(base);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.endAt.getTime() - v.startAt.getTime()).toBe(3600_000);
  });

  it("requires end after start (equal and earlier are rejected)", () => {
    expect(validateEventForm({ ...base, end: base.start })).toMatchObject({ ok: false, errors: { end: expect.any(String) } });
    expect(validateEventForm({ ...base, end: "2026-05-04T09:00" })).toMatchObject({ ok: false });
  });

  it("validates title, zone and DST gap, and caps duration", () => {
    expect(validateEventForm({ ...base, title: "   " })).toMatchObject({ ok: false, errors: { title: expect.any(String) } });
    expect(validateEventForm({ ...base, timeZone: "Nope/Zone" })).toMatchObject({ ok: false, errors: { timeZone: expect.any(String) } });
    expect(
      validateEventForm({ ...base, timeZone: "America/New_York", start: "2026-03-08T02:30", end: "2026-03-08T04:00" }),
    ).toMatchObject({ ok: false, errors: { start: expect.stringContaining("does not exist") } });
    expect(validateEventForm({ ...base, end: "2026-06-04T11:00" })).toMatchObject({ ok: false, errors: { end: expect.any(String) } });
  });
});
