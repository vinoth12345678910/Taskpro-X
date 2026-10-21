import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resilient } from "@/lib/resilient";

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.useRealTimers());

describe("resilient listener", () => {
  it("re-subscribes with exponential backoff after errors and resets after a good snapshot", () => {
    const fails: Array<(e: unknown) => void> = [];
    const oks: Array<(v: number) => void> = [];
    const sub = vi.fn((ok: (v: number) => void, err: (e: unknown) => void) => {
      oks.push(ok);
      fails.push(err);
      return vi.fn();
    });
    const next = vi.fn();
    const giveUp = vi.fn();
    const stop = resilient<number>(sub, next, giveUp, { baseMs: 100, retries: 2 });
    expect(sub).toHaveBeenCalledTimes(1);

    fails[0]("boom");
    vi.advanceTimersByTime(99);
    expect(sub).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(sub).toHaveBeenCalledTimes(2);

    oks[1](42); // success resets the retry budget
    expect(next).toHaveBeenCalledWith(42);
    fails[1]("again");
    vi.advanceTimersByTime(100);
    expect(sub).toHaveBeenCalledTimes(3);
    fails[2]("x");
    vi.advanceTimersByTime(200);
    expect(sub).toHaveBeenCalledTimes(4);
    fails[3]("y");
    vi.advanceTimersByTime(10_000);
    expect(sub).toHaveBeenCalledTimes(4); // retries exhausted
    expect(giveUp).toHaveBeenCalledWith("y");
    stop();
  });

  it("stops cleanly: no resubscribe after unsubscribe", () => {
    const unsubInner = vi.fn();
    let err: (e: unknown) => void = () => undefined;
    const sub = vi.fn((_ok: (v: number) => void, e: (x: unknown) => void) => {
      err = e;
      return unsubInner;
    });
    const stop = resilient<number>(sub, vi.fn(), vi.fn(), { baseMs: 50 });
    err("e");
    stop();
    vi.advanceTimersByTime(5000);
    expect(sub).toHaveBeenCalledTimes(1);
  });
});
