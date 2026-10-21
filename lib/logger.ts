/**
 * Minimal structured logger for the browser.
 *
 * - One JSON line per event so it is greppable in devtools / log drains.
 * - Never log tokens, passwords or message bodies: callers pass identifiers and
 *   error codes only; `redact` strips obvious secret-looking keys as a backstop.
 * - `setErrorReporter` is the hook for an error-reporting service (none is bundled).
 */
type Level = "debug" | "info" | "warn" | "error";
type Context = Record<string, unknown>;

const SECRET_KEY = /pass(word)?|token|secret|authorization|api[-_]?key|cookie|^text$|^body$|content/i;

export function redact(ctx: Context | undefined): Context | undefined {
  if (!ctx) return ctx;
  const out: Context = {};
  for (const [k, v] of Object.entries(ctx)) {
    out[k] = SECRET_KEY.test(k) ? "[redacted]" : v;
  }
  return out;
}

export function errorInfo(err: unknown): { code?: string; message: string } {
  if (err && typeof err === "object") {
    const e = err as { code?: unknown; message?: unknown };
    return {
      code: typeof e.code === "string" ? e.code : undefined,
      message: typeof e.message === "string" ? e.message : String(err),
    };
  }
  return { message: String(err) };
}

type Reporter = (entry: { level: Level; scope: string; msg: string; ctx?: Context }) => void;
let reporter: Reporter | null = null;
export function setErrorReporter(r: Reporter | null) {
  reporter = r;
}

export function log(level: Level, scope: string, msg: string, ctx?: Context) {
  const entry = { level, scope, msg, ctx: redact(ctx), t: new Date().toISOString() };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (process.env.NODE_ENV !== "production") console.log(line);
  if (level === "error" || level === "warn") {
    try {
      reporter?.({ level, scope, msg, ctx: entry.ctx });
    } catch {
      /* reporting must never break the app */
    }
  }
}

export const logError = (scope: string, msg: string, err: unknown, ctx?: Context) =>
  log("error", scope, msg, { ...ctx, ...errorInfo(err) });
