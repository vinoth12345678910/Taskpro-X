"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homeFor, useAuth } from "@/components/providers/AuthProvider";
import { NotificationsProvider } from "@/components/providers/NotificationsProvider";
import { Button } from "@/components/ui/Button";
import { ErrorState, Logo, Skeleton } from "@/components/ui/misc";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CreateTeamOnboarding, JoinTeamOnboarding } from "./Onboarding";
import { Shell } from "./Shell";
import { TeamProvider } from "./TeamContext";

export function FullPageLoading({ label = "Loading your workspace" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="grid min-h-dvh place-items-center bg-paper">
      <div className="flex flex-col items-center gap-4">
        <Logo size={40} />
        <Skeleton className="h-2.5 w-40" />
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}

/**
 * Shared by /teamlead-dashboard and /member-dashboard. The route a person lands on is decided by the role
 * stored on their profile (never by what the client claims), so opening the "wrong" URL redirects.
 */
export function WorkspaceApp({ expected }: { expected: "team_lead" | "member" }) {
  const router = useRouter();
  const { status, profile, memberships, membershipsReady, membershipError, activeTeamId, repairProfile, signOut } = useAuth();

  useEffect(() => {
    if (status === "signed-out") router.replace("/login");
    else if (status === "ready" && profile && profile.role !== expected) router.replace(homeFor(profile.role));
  }, [status, profile, expected, router]);

  if (status === "profile-missing") {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper px-4">
        <ErrorState title="Finish setting up your account" onRetry={undefined}>
          We couldn&apos;t find your profile. You can create one now as a team member, or sign out and sign in with a different account.
          <span className="mt-4 flex justify-center gap-2">
            <Button variant="primary" onClick={() => void repairProfile()}>Create my profile</Button>
            <Button onClick={() => void signOut()}>Sign out</Button>
          </span>
        </ErrorState>
      </div>
    );
  }
  if (status !== "ready" || !profile || profile.role !== expected || !membershipsReady) return <FullPageLoading />;

  if (membershipError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper px-4">
        <ErrorState title="Couldn't load your teams" onRetry={() => window.location.reload()}>
          Check your connection and try again.
        </ErrorState>
      </div>
    );
  }

  if (memberships.length === 0) {
    return (
      <NotificationsProvider>
        <div className="min-h-dvh bg-paper">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="flex items-center gap-2.5 text-title font-semibold"><Logo size={26} /> TaskProX</span>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button>
            </div>
          </div>
          <main id="main" className="min-h-[calc(100dvh-4.5rem)]">
            {expected === "team_lead" ? <CreateTeamOnboarding profile={profile} /> : <JoinTeamOnboarding profile={profile} />}
          </main>
        </div>
      </NotificationsProvider>
    );
  }

  if (!activeTeamId) return <FullPageLoading />;
  return (
    <NotificationsProvider>
      <TeamProvider key={activeTeamId} teamId={activeTeamId}>
        <Shell />
      </TeamProvider>
    </NotificationsProvider>
  );
}
