"use client";
import { signInWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthShell } from "@/components/AuthShell";
import { homeFor, useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { auth } from "@/lib/firebase";
import { friendlyError } from "@/lib/firestore-utils";
import { logError } from "@/lib/logger";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { status, profile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in (or just signed in): go to the right dashboard for the stored role.
  useEffect(() => {
    if (status === "ready" && profile) router.replace(homeFor(profile.role));
  }, [status, profile, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      logError("auth", "sign-in failed", err);
      setError(friendlyError(err, "We couldn't sign you in. Please try again."));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your workspace."
      footer={
        <>
          New to TaskProX?{" "}
          <Link href="/signup" className="font-medium text-accent-text underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Field label="Email" required>
          {(p) => (
            <Input {...p} type="email" name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          )}
        </Field>
        <Field label="Password" required>
          {(p) => (
            <div className="relative">
              <Input
                {...p}
                type={show ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide password" : "Show password"}
                aria-pressed={show}
                className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-md text-ink-3 hover:bg-surface-2"
              >
                {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          )}
        </Field>
        {error && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" loading={busy} className="w-full">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
