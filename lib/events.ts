import { zonedLocalToUtc, isValidTimeZone } from "./datetime";

export const EVENT_TITLE_MAX = 120;
export const EVENT_DESC_MAX = 2000;
export const EVENT_MAX_DURATION_MS = 14 * 24 * 3600 * 1000;

export interface EventFormInput {
  title: string;
  description: string;
  /** `YYYY-MM-DDTHH:mm` typed in `timeZone` */
  start: string;
  end: string;
  timeZone: string;
}

export interface EventFormErrors {
  title?: string;
  description?: string;
  start?: string;
  end?: string;
  timeZone?: string;
}

export type EventValidation =
  | { ok: true; title: string; description: string; startAt: Date; endAt: Date; timeZone: string; warnings: string[] }
  | { ok: false; errors: EventFormErrors };

export function validateEventForm(input: EventFormInput): EventValidation {
  const errors: EventFormErrors = {};
  const warnings: string[] = [];
  const title = input.title.trim();
  const description = input.description.trim();

  if (!title) errors.title = "Give the event a title.";
  else if (title.length > EVENT_TITLE_MAX) errors.title = `Keep the title under ${EVENT_TITLE_MAX} characters.`;
  if (description.length > EVENT_DESC_MAX) errors.description = `Keep the description under ${EVENT_DESC_MAX} characters.`;
  if (!isValidTimeZone(input.timeZone)) errors.timeZone = "Choose a valid time zone.";

  const start = errors.timeZone ? null : zonedLocalToUtc(input.start, input.timeZone);
  const end = errors.timeZone ? null : zonedLocalToUtc(input.end, input.timeZone);

  const explain = (r: Exclude<ReturnType<typeof zonedLocalToUtc>, { ok: true }>) =>
    r.reason === "nonexistent"
      ? "That time does not exist in this time zone (daylight-saving change). Pick another time."
      : "Enter a valid date and time.";
  if (start && !start.ok) errors.start = explain(start);
  if (end && !end.ok) errors.end = explain(end);

  if (start?.ok && end?.ok) {
    if (end.date.getTime() <= start.date.getTime()) errors.end = "The end must be after the start.";
    else if (end.date.getTime() - start.date.getTime() > EVENT_MAX_DURATION_MS) {
      errors.end = "Events can last at most 14 days.";
    }
    if (start.ambiguous || end.ambiguous) {
      warnings.push("This time occurs twice on the day clocks go back; the earlier occurrence was used.");
    }
  }

  if (Object.keys(errors).length || !start?.ok || !end?.ok) return { ok: false, errors };
  return { ok: true, title, description, startAt: start.date, endAt: end.date, timeZone: input.timeZone, warnings };
}

export type EventStatus = "scheduled" | "cancelled";

export function isUpcoming(endMs: number, status: EventStatus, nowMs: number): boolean {
  return status === "scheduled" && endMs >= nowMs;
}
