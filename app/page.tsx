import Link from "next/link";
import { CalendarClock, FolderOpen, MessageSquareReply, BellRing, ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui/misc";
import { ThemeToggle } from "@/components/ThemeToggle";

const FEATURES = [
  {
    icon: MessageSquareReply,
    title: "Conversations that stay on topic",
    body: "Team chat with threaded replies, reactions, @mentions and edit/delete rules that match who is in the room.",
  },
  {
    icon: CalendarClock,
    title: "Events with the right time for everyone",
    body: "Schedule once in any time zone. Every teammate sees it in their own, and daylight-saving changes are handled for you.",
  },
  {
    icon: FolderOpen,
    title: "Files and links your team can find",
    body: "A shared library per team: upload documents or save links, search them, and keep access limited to members.",
  },
  {
    icon: BellRing,
    title: "Notifications you control",
    body: "Mentions, replies and event changes in one inbox with read states. Choose which ones you want per team.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5 text-title font-semibold">
          <Logo size={28} /> TaskProX
        </Link>
        <nav aria-label="Account" className="flex items-center gap-1.5">
          <ThemeToggle />
          <Link href="/login" className="rounded-md px-3 py-2 text-body font-medium text-ink-2 hover:bg-surface-2">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-md bg-accent px-4 py-2 text-body font-medium text-accent-ink hover:bg-accent-hover">
            Get started
          </Link>
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto max-w-6xl px-5 pb-20 pt-16 sm:pt-24">
          <p className="mb-4 text-caption font-semibold uppercase tracking-widest text-accent-text">Team workspace</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            Talk, plan and share — <span className="text-accent-text">in one calm place.</span>
          </h1>
          <p className="mt-6 max-w-xl text-title text-ink-2">
            TaskProX gives every team a shared conversation, a calendar that respects time zones, and a library of the files and links that matter.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/signup" className="inline-flex h-12 items-center gap-2 rounded-md bg-accent px-6 text-title font-medium text-accent-ink hover:bg-accent-hover">
              Create your team <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/login" className="inline-flex h-12 items-center rounded-md border border-line-strong bg-surface px-6 text-title font-medium hover:bg-surface-2">
              Sign in
            </Link>
          </div>
        </section>

        <section aria-labelledby="features-h" className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 id="features-h" className="text-heading font-semibold tracking-tight">What&apos;s inside</h2>
            <ul className="mt-8 grid gap-x-10 gap-y-10 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-text" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <div>
                    <h3 className="text-title font-semibold">{title}</h3>
                    <p className="mt-1 text-body text-ink-2">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="how-h" className="mx-auto max-w-6xl px-5 py-16">
          <h2 id="how-h" className="text-heading font-semibold tracking-tight">Up and running in three steps</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {["A team lead creates a team and gets an invite code.", "Members join with the code — nobody can join without it.", "Chat, schedule events and share files right away."].map((s, i) => (
              <li key={s} className="rounded-lg border border-line bg-surface p-5">
                <span className="mb-3 grid h-8 w-8 place-items-center rounded-md bg-ink text-body font-semibold text-paper">{i + 1}</span>
                <p className="text-body text-ink-2">{s}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-caption text-ink-3">
          <span className="flex items-center gap-2"><Logo size={18} /> TaskProX</span>
          <span>Built with Next.js and Firebase.</span>
        </div>
      </footer>
    </div>
  );
}
