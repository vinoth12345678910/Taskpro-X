"use client";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthShell } from "@/components/AuthShell";
import { homeFor, useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { cn } from "@/components/ui/cn";
import { auth, db } from "@/lib/firebase";
import { friendlyError } from "@/lib/firestore-utils";
import { logError } from "@/lib/logger";
import { Eye, EyeOff, Users, Crown } from "lucide-react";

type ChosenRole = "member" | "team_lead";
const ROLES: { value: ChosenRole; label: string; hint: string; icon: typeof Users }[] = [
  { value: "member", label: "Team member", hint: "Join a team with an invite code", icon: Users },
  { value: "team_lead", label: "Team lead", hint: "Create a team and schedule events", icon: Crown },
];

export default function SignupPage() {
  const router = useRouter();
  const { status, profile } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<ChosenRole>("member");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; form?: string }>({});

  useEffect(() => {
    if (status === "ready" && profile) router.replace(homeFor(profile.role));
  }, [status, profile, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Tell us your name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Enter a valid email address.";
    if (password.length < 6) next.password = "Use at least 6 characters.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      // Roles are limited to member / team_lead here and enforced again by security rules.
      // Administrator access is never self-service: it is granted by editing the profile in the Firebase console.
      await setDoc(doc(db, "users", cred.user.uid), {
        name: name.trim(),
        email: cred.user.email,
        role,
        createdAt: serverTimestamp(),
      });
      await updateProfile(cred.user, { displayName: name.trim() }).catch(() => undefined);
    } catch (err) {
      logError("auth", "sign-up failed", err);
      setErrors({ form: friendlyError(err, "We couldn't create your account. Please try again.") });
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="It takes less than a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent-text underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Field label="Full name" required error={errors.name}>
          {(p) => <Input {...p} name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Email" required error={errors.email}>
          {(p) => <Input {...p} type="email" name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Password" required error={errors.password} hint="At least 6 characters.">
          {(p) => (
            <div className="relative">
              <Input
                {...p}
                type={show ? "text" : "password"}
                name="password"
                autoComplete="new-password"
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

        <fieldset>
          <legend className="mb-1.5 text-caption font-medium text-ink-2">I&apos;m joining as</legend>
          <div className="grid gap-2">
            {ROLES.map(({ value, label, hint, icon: Icon }) => (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]",
                  role === value ? "border-ink bg-surface" : "border-line-strong hover:bg-surface-2",
                )}
              >
                <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} className="sr-only" />
                <span className={cn("grid h-9 w-9 place-items-center rounded-md", role === value ? "bg-accent text-accent-ink" : "bg-surface-3 text-ink-2")}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-body font-medium">{label}</span>
                  <span className="block text-caption text-ink-3">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {errors.form && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">
            {errors.form}
          </p>
        )}
        <Button type="submit" variant="primary" loading={busy} className="w-full">
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
