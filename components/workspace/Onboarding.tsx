"use client";
import { Crown, KeyRound, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useToast } from "@/components/providers/Toast";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { friendlyError } from "@/lib/firestore-utils";
import { logError } from "@/lib/logger";
import { JoinError, createTeam, joinTeam } from "@/lib/teams";
import type { Profile } from "@/lib/types";

export function CreateTeamOnboarding({ profile }: { profile: Profile }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) return setError("Give your team a name.");
    if (name.trim().length > 60) return setError("Keep the team name under 60 characters.");
    setBusy(true);
    setError(null);
    try {
      await createTeam(profile, name);
      toast({ tone: "success", title: "Team created", description: "Share your invite code from the People tab." });
    } catch (err) {
      logError("teams", "create team failed", err);
      setError(friendlyError(err, "We couldn't create the team. Please try again."));
      setBusy(false);
    }
  }

  return (
    <OnboardingFrame icon={<Crown size={22} />} title="Set up your team" lead={`Welcome, ${profile.name.split(" ")[0]}. Name your team to open its chat, calendar and shared files.`}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Team name" required error={error ?? undefined}>
          {(p) => <Input {...p} invalid={p.invalid} value={name} onChange={(e) => setName(e.target.value)} placeholder="Design team" maxLength={80} autoFocus />}
        </Field>
        <Button type="submit" variant="primary" loading={busy} className="w-full">Create team</Button>
      </form>
      <ol className="mt-8 space-y-3 text-body text-ink-2">
        <li className="flex gap-3"><b className="text-ink">1.</b> Create the team and get an invite code.</li>
        <li className="flex gap-3"><b className="text-ink">2.</b> Share the code with your people.</li>
        <li className="flex gap-3"><b className="text-ink">3.</b> Schedule events and start talking.</li>
      </ol>
    </OnboardingFrame>
  );
}

export function JoinTeamOnboarding({ profile }: { profile: Profile }) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const m = await joinTeam(profile, code);
      toast({ tone: "success", title: `Welcome to ${m.teamName}` });
    } catch (err) {
      if (!(err instanceof JoinError)) logError("teams", "join team failed", err);
      setError(err instanceof JoinError ? err.message : friendlyError(err, "We couldn't join the team. Please try again."));
      setBusy(false);
    }
  }

  return (
    <OnboardingFrame icon={<Users size={22} />} title="Join your team" lead="Ask your team lead for the invite code, then enter it below.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Invite code" required error={error ?? undefined}>
          {(p) => (
            <Input
              {...p}
              invalid={p.invalid}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              maxLength={12}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="K7M2QX9A"
              className="text-center font-mono text-title tracking-[0.3em]"
              autoFocus
            />
          )}
        </Field>
        <Button type="submit" variant="primary" loading={busy} disabled={code.length < 6} className="w-full">
          <KeyRound size={16} aria-hidden="true" /> Join team
        </Button>
      </form>
    </OnboardingFrame>
  );
}

function OnboardingFrame({ icon, title, lead, children }: { icon: React.ReactNode; title: string; lead: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-5 py-12">
      <div className="mb-5 grid h-12 w-12 place-items-center rounded-lg bg-accent-soft text-accent-text" aria-hidden="true">{icon}</div>
      <h1 className="text-heading font-semibold tracking-tight">{title}</h1>
      <p className="mb-6 mt-1 text-body text-ink-3">{lead}</p>
      {children}
    </div>
  );
}
