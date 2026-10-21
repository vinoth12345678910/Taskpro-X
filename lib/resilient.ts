import { log } from "./logger";

type Unsubscribe = () => void;

/**
 * Keep a Firestore listener alive. If it errors (token refresh race, brief permission flip, transient backend
 * fault) re-subscribe with exponential backoff; give up after `retries` consecutive failures and report the error.
 * A successful snapshot resets the counter.
 */
export function resilient<T>(
  subscribe: (onNext: (value: T) => void, onError: (e: unknown) => void) => Unsubscribe,
  onNext: (value: T) => void,
  onGiveUp: (e: unknown) => void,
  { retries = 4, baseMs = 800, scope = "listener" }: { retries?: number; baseMs?: number; scope?: string } = {},
): Unsubscribe {
  let stopped = false;
  let attempt = 0;
  let unsub: Unsubscribe | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const start = () => {
    unsub = subscribe(
      (v) => {
        attempt = 0;
        onNext(v);
      },
      (e) => {
        unsub?.();
        unsub = null;
        if (stopped) return;
        if (attempt >= retries) {
          log("error", scope, "listener gave up", { attempts: attempt });
          onGiveUp(e);
          return;
        }
        const delay = baseMs * 2 ** attempt++;
        log("warn", scope, "listener error; retrying", { attempt, delay });
        timer = setTimeout(start, delay);
      },
    );
  };
  start();
  return () => {
    stopped = true;
    clearTimeout(timer);
    unsub?.();
  };
}
