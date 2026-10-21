"use client";
import { Check, Copy, Crown, KeyRound, LogOut, RefreshCw, UserMinus } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/Toast";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Avatar, Badge, ErrorState, Skeleton } from "@/components/ui/misc";
import { friendlyError } from "@/lib/firestore-utils";
import { isOnline } from "@/lib/presence";
import { leaveTeam, regenerateInvite, removeMember, updatePrefs } from "@/lib/teams";
import { DEFAULT_PREFS, type Membership, type NotificationPrefs } from "@/lib/types";
import { useTeam } from "./TeamContext";

const PREF_LABELS: [keyof NotificationPrefs, string, string][] = [
  ["mentions", "Mentions", "When someone @mentions you"],
  ["replies", "Replies", "When someone replies to your message"],
  ["events", "Events", "When an event is scheduled, changed or cancelled"],
  ["joins", "New members", "When someone joins the team (team leads)"],
];

export function PeopleView() {
  const t = useTeam();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [removing, setRemoving] = useState<Membership | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regen, setRegen] = useState(false);
  const mine = t.roster.find((r) => r.uid === t.me.uid);
  const prefs = { ...DEFAULT_PREFS, ...(mine?.prefs ?? {}) };

  async function copyCode() {
    if (!t.invite) return;
    try {
      await navigator.clipboard.writeText(t.invite.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ tone: "error", title: "Couldn't copy", description: "Select the code and copy it manually." });
    }
  }

  async function togglePref(key: keyof NotificationPrefs) {
    try {
      await updatePrefs(t.teamId, t.me.uid, { ...prefs, [key]: !prefs[key] });
    } catch (e) {
      toast({ tone: "error", title: "Couldn't save preference", description: friendlyError(e) });
    }
  }

  const online = t.roster.filter((r) => isOnline(t.presence[r.uid])).length;

  return (
    <div className="mx-auto h-full w-full max-w-4xl space-y-8 overflow-y-auto px-4 py-6 sm:px-6">
      <div>
        <h2 className="text-heading font-semibold tracking-tight">People</h2>
        <p className="text-body text-ink-3">
          {t.roster.length} {t.roster.length === 1 ? "member" : "members"} · {online} online now
        </p>
      </div>

      {t.isLead && (
        <section aria-labelledby="invite-h" className="rounded-lg border border-line bg-surface p-5">
          <h3 id="invite-h" className="flex items-center gap-2 text-title font-semibold">
            <KeyRound size={18} aria-hidden="true" /> Invite code
          </h3>
          <p className="mt-1 text-body text-ink-3">Share this code with people you want on the team. Anyone who has it can join, so generate a new one if it spreads further than intended.</p>
          {t.invite ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <code data-testid="invite-code" className="rounded-md bg-surface-2 px-4 py-2 font-mono text-heading font-semibold tracking-[0.25em]">{t.invite.code}</code>
              <Button onClick={() => void copyCode()}>
                {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                loading={regen}
                onClick={async () => {
                  setRegen(true);
                  try {
                    await regenerateInvite(t.me, t.teamName, t.invite?.code);
                    toast({ tone: "success", title: "New invite code created", description: "The previous code no longer works." });
                  } catch (e) {
                    toast({ tone: "error", title: "Couldn't create a new code", description: friendlyError(e) });
                  } finally {
                    setRegen(false);
                  }
                }}
              >
                <RefreshCw size={16} aria-hidden="true" /> New code
              </Button>
            </div>
          ) : (
            <div className="mt-4 text-body text-ink-3">
              No active code.{" "}
              <Button size="sm" variant="primary" onClick={() => void regenerateInvite(t.me, t.teamName).catch((e) => toast({ tone: "error", title: "Couldn't create a code", description: friendlyError(e) }))}>
                Create one
              </Button>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="roster-h">
        <h3 id="roster-h" className="sr-only">Team members</h3>
        {t.rosterState === "loading" && <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>}
        {t.rosterState === "error" && <ErrorState title="Couldn't load the team" onRetry={t.retry} />}
        {t.rosterState === "ready" && (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {t.roster.map((r) => {
              const on = isOnline(t.presence[r.uid]);
              const away = on && t.presence[r.uid]?.status === "away";
              return (
                <li key={r.id} className="flex items-center gap-3 p-3.5">
                  <Avatar name={r.name} lead={r.userType === "TEAM_LEAD"} self={r.uid === t.me.uid} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-body font-medium">
                      {r.name}
                      {r.uid === t.me.uid && <span className="text-caption font-normal text-ink-3">(you)</span>}
                      {r.userType === "TEAM_LEAD" && <Badge tone="accent"><Crown size={11} aria-hidden="true" /> Lead</Badge>}
                    </p>
                    <p className="truncate text-caption text-ink-3">{r.email}</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-caption text-ink-3">
                    <span className={`h-2 w-2 rounded-full ${on ? (away ? "bg-warn" : "bg-ok") : "bg-line-strong"}`} aria-hidden="true" />
                    {on ? (away ? "Away" : "Online") : "Offline"}
                  </span>
                  {t.isLead && r.uid !== t.me.uid && (
                    <Button size="icon" variant="ghost" aria-label={`Remove ${r.name} from the team`} onClick={() => setRemoving(r)}>
                      <UserMinus size={16} aria-hidden="true" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="prefs-h" className="rounded-lg border border-line bg-surface p-5">
        <h3 id="prefs-h" className="text-title font-semibold">Notification preferences</h3>
        <p className="mt-1 text-body text-ink-3">For {t.teamName}. Notifications you turn off here are never delivered to you.</p>
        <ul className="mt-4 divide-y divide-line">
          {PREF_LABELS.filter(([k]) => k !== "joins" || t.isLead).map(([key, label, hint]) => (
            <li key={key} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p id={`pref-${key}`} className="text-body font-medium">{label}</p>
                <p className="text-caption text-ink-3">{hint}</p>
              </div>
              <button
                role="switch"
                aria-checked={prefs[key]}
                aria-labelledby={`pref-${key}`}
                onClick={() => void togglePref(key)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${prefs[key] ? "bg-accent" : "bg-surface-3"}`}
              >
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-card transition-transform ${prefs[key] ? "translate-x-5" : ""}`} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {!t.isLead && profile && (
        <div>
          <Button variant="secondary" onClick={() => setLeaving(true)}>
            <LogOut size={16} aria-hidden="true" /> Leave team
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.name ?? "member"}?`}
        description="They lose access to the team's messages, events and files immediately. They can rejoin with a valid invite code."
        confirmLabel="Remove from team"
        onConfirm={async () => {
          if (!removing) return;
          try {
            await removeMember(t.teamId, removing.uid);
            toast({ tone: "success", title: `${removing.name} was removed` });
          } catch (e) {
            toast({ tone: "error", title: "Couldn't remove the member", description: friendlyError(e) });
          }
        }}
      />
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={`Leave ${t.teamName}?`}
        description="You'll lose access to this team's messages, events and files. You can rejoin with a new invite code."
        confirmLabel="Leave team"
        onConfirm={async () => {
          try {
            await leaveTeam(t.teamId, t.me.uid);
          } catch (e) {
            toast({ tone: "error", title: "Couldn't leave the team", description: friendlyError(e) });
          }
        }}
      />
    </div>
  );
}
