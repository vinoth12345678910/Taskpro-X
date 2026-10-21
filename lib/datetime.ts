/**
 * Time-zone aware date helpers (no dependencies).
 *
 * Storage contract for events:
 *  - `startAt` / `endAt` are Firestore Timestamps, i.e. absolute UTC instants.
 *  - `timeZone` is the IANA zone the author picked; it is only used to
 *    interpret the wall-clock input and to render the event for everyone.
 */

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function getBrowserTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && isValidTimeZone(tz) ? tz : "UTC";
  } catch {
    return "UTC";
  }
}

/** Wall-clock components of an instant in a zone. */
export function getZonedParts(date: Date, timeZone: string) {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(timeZone).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export type ZonedParse =
  | { ok: true; date: Date; ambiguous: boolean }
  | { ok: false; reason: "format" | "timezone" | "nonexistent" };

/**
 * Convert a `<input type="datetime-local">` value (`YYYY-MM-DDTHH:mm`) that
 * was typed in `timeZone` into an absolute instant.
 *  - Times skipped by a DST "spring forward" are rejected (`nonexistent`).
 *  - Times repeated by a DST "fall back" resolve to the first occurrence and
 *    are flagged `ambiguous`.
 */
export function zonedLocalToUtc(local: string, timeZone: string): ZonedParse {
  const m = LOCAL_RE.exec(local);
  if (!m) return { ok: false, reason: "format" };
  if (!isValidTimeZone(timeZone)) return { ok: false, reason: "timezone" };
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi, 0);
  const check = new Date(naive);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d ||
    check.getUTCHours() !== h
  ) {
    return { ok: false, reason: "format" };
  }

  const matches = (candidate: number) => {
    const p = getZonedParts(new Date(candidate), timeZone);
    return p.year === y && p.month === mo && p.day === d && p.hour === h && p.minute === mi;
  };

  // Candidate instants: the naive time shifted by each offset in play around it.
  const offsets = new Set<number>();
  for (const probe of [naive - 36e5 * 24, naive, naive + 36e5 * 24]) {
    offsets.add(zoneOffsetMs(new Date(probe), timeZone));
  }
  const valid = [...offsets]
    .map((off) => naive - off)
    .filter(matches)
    .sort((a, b) => a - b);

  if (valid.length === 0) return { ok: false, reason: "nonexistent" };
  return { ok: true, date: new Date(valid[0]), ambiguous: valid.length > 1 };
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** Inverse of `zonedLocalToUtc`: value for a datetime-local input. */
export function utcToZonedLocal(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** `YYYY-MM-DD` of the instant as seen in `timeZone` (calendar grouping key). */
export function dayKey(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

export function formatInZone(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
  locale?: string,
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date);
}

/** Short zone label such as `PDT` / `GMT+5:30` for an instant. */
export function zoneAbbreviation(date: Date, timeZone: string, locale?: string): string {
  const part = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? timeZone;
}
