"use client";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { homeFor, useAuth } from "@/components/providers/AuthProvider";
import { FullPageLoading } from "@/components/workspace/WorkspaceApp";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, ErrorState, Logo, Skeleton } from "@/components/ui/misc";
import { db } from "@/lib/firebase";
import { logError } from "@/lib/logger";
import { toDate } from "@/lib/firestore-utils";
import { Shield, Users, LayoutGrid } from "lucide-react";

interface TeamRow { id: string; teamName: string; leadName: string; leadEmail: string; createdAt?: Date }
interface UserRow { id: string; name: string; email: string; role: string }

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export default function AdminDashboard() {
  const router = useRouter();
  const { status, profile, signOut } = useAuth();
  const [teams, setTeams] = useState<TeamRow[] | null>(null);
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (status === "signed-out") router.replace("/login");
    else if (status === "ready" && profile && profile.role !== "admin") router.replace(homeFor(profile.role));
  }, [status, profile, router]);

  const load = useCallback(async () => {
    setError(false);
    try {
      const [t, u] = await Promise.all([
        getDocs(query(collection(db, "team_members"), where("userType", "==", "TEAM_LEAD"))),
        getDocs(query(collection(db, "users"), orderBy("name"))),
      ]);
      setTeams(t.docs.map((d) => ({ id: d.id, teamName: d.data().teamName, leadName: d.data().name, leadEmail: d.data().email, createdAt: toDate(d.data().joinedAt) })));
      setUsers(u.docs.map((d) => ({ id: d.id, name: d.data().name ?? "", email: d.data().email ?? "", role: d.data().role ?? "member" })));
    } catch (e) {
      logError("admin", "load failed", e);
      setError(true);
    }
  }, []);

  const isAdmin = status === "ready" && profile?.role === "admin";
  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  if (!isAdmin) return <FullPageLoading label="Loading administration" />;

  return (
    <div className="min-h-dvh bg-paper">
      <header className="flex h-14 items-center justify-between border-b border-line px-4 sm:px-6">
        <span className="flex items-center gap-2.5 text-title font-semibold"><Logo size={26} /> TaskProX <Badge tone="accent"><Shield size={11} aria-hidden="true" /> Admin</Badge></span>
        <div className="flex items-center gap-2">
          <span className="hidden text-body text-ink-3 sm:block">{profile?.name}</span>
          <ThemeToggle />
          <Button size="sm" onClick={() => void signOut()}>Sign out</Button>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-heading font-semibold tracking-tight">Administration</h1>
        <p className="mb-6 text-body text-ink-3">Read-only overview of teams and accounts. Roles are changed in the Firebase console.</p>
        {error && <ErrorState title="Couldn't load data" onRetry={() => void load()}>You may not have administrator permissions.</ErrorState>}
        {!error && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="teams-h" className="rounded-lg border border-line bg-surface">
              <h2 id="teams-h" className="flex items-center gap-2 border-b border-line px-4 py-3 text-title font-semibold"><LayoutGrid size={18} aria-hidden="true" /> Teams {teams && <span className="font-normal text-ink-3">({teams.length})</span>}</h2>
              {teams === null ? <div className="space-y-2 p-4" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
                : teams.length === 0 ? <EmptyState icon={<LayoutGrid size={22} />} title="No teams yet">Teams appear here when a team lead creates one.</EmptyState>
                : <ul className="divide-y divide-line">{teams.map((t) => (
                    <li key={t.id} className="px-4 py-3">
                      <p className="text-body font-medium">{t.teamName}</p>
                      <p className="text-caption text-ink-3">Lead: {t.leadName} · {t.leadEmail}{t.createdAt && ` · created ${dateFmt.format(t.createdAt)}`}</p>
                    </li>))}</ul>}
            </section>
            <section aria-labelledby="users-h" className="rounded-lg border border-line bg-surface">
              <h2 id="users-h" className="flex items-center gap-2 border-b border-line px-4 py-3 text-title font-semibold"><Users size={18} aria-hidden="true" /> Accounts {users && <span className="font-normal text-ink-3">({users.length})</span>}</h2>
              {users === null ? <div className="space-y-2 p-4" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
                : users.length === 0 ? <EmptyState icon={<Users size={22} />} title="No accounts" />
                : <ul className="divide-y divide-line">{users.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0"><p className="truncate text-body font-medium">{u.name}</p><p className="truncate text-caption text-ink-3">{u.email}</p></div>
                      <Badge tone={u.role === "admin" ? "danger" : u.role === "team_lead" ? "accent" : "neutral"}>{u.role.replace("_", " ")}</Badge>
                    </li>))}</ul>}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
