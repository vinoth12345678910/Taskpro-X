"use client";
import { useEffect } from "react";
import { logError } from "@/lib/logger";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logError("app", "unhandled render error", error, { digest: error.digest });
  }, [error]);
  return (
    <main id="main" role="alert" className="grid min-h-dvh place-items-center bg-paper px-5 text-center">
      <div>
        <h1 className="text-heading font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-1 text-body text-ink-3">An unexpected error occurred. Your data is safe — try again.</p>
        <button onClick={reset} className="mt-6 h-10 rounded-md bg-accent px-4 text-body font-medium text-accent-ink hover:bg-accent-hover">
          Try again
        </button>
      </div>
    </main>
  );
}
