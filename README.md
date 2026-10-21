# TaskProX

A team workspace: threaded chat, scheduled events that show the right time for everyone, shared files and links, and a notification inbox.
Next.js 15 (App Router, static export) + Firebase (Auth, Firestore, Storage), hosted on Firebase Hosting.

> There is no Node server at runtime and **no Socket.IO**: Firestore listeners are the single real-time transport.
> See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for why, and [docs/OPERATIONS.md](docs/OPERATIONS.md) for deploy / rollback.

## Features

| Area | What you get |
| --- | --- |
| Teams | A team lead creates a team and shares an invite code; members join with it. One person can belong to several teams (team switcher). |
| Chat | Live messages, paginated history, threaded replies, reactions, edit / delete (author, or lead), `@mentions`, offline-safe sending that never duplicates. |
| Events | Lead schedules / edits / cancels events in any IANA time zone. Everyone sees them in their own zone; DST-skipped times are rejected. Month calendar + agenda. |
| Notifications | Mentions, replies, event created/changed/cancelled, new members. Read / unread, mark all read, grouping, per-team preferences. |
| Resources | Team file library (Firebase Storage, ≤ 10 MB, allow-listed types) and links; search + filter; owner/lead can edit or delete. |
| People | Roster, online presence, invite-code management, notification preferences, leave / remove. |
| Search | `Ctrl/Cmd+K` palette across the current team's members, events, files and loaded messages, plus team switching. |
| Admin | Read-only overview of teams and accounts (role granted out-of-band, see operations). |

Keyboard: `Ctrl/Cmd+K` search · `Alt+1…4` switch view · `Enter` send / `Shift+Enter` newline · `Esc` closes dialogs and threads.

## Develop

```bash
npm ci
npm run dev            # uses the Firebase project configured in lib/firebase.ts
```

To work without touching production data, run against the local emulators:

```bash
npx firebase emulators:start --only auth,firestore,storage --project taskprox-local
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=1 NEXT_PUBLIC_FIREBASE_PROJECT_ID=taskprox-local npm run dev
```

## Quality gates

| Command | What it runs |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (next/core-web-vitals + typescript) — zero warnings |
| `npm test` | Vitest unit tests (time zones, DST, validation, mentions, notifications, logger, resilient listeners) |
| `npm run test:rules` | Firestore + Storage security rules and the migration script, on the emulators (needs Java) |
| `npm run test:e2e` | Builds with emulator wiring, then Playwright: two real browser clients, chat, events, notifications, resources, admin, mobile viewport, axe accessibility scans |
| `npm run build` | Production static export to `out/` |
| `npm run check` | Everything above except e2e |

## Repository map

```
app/                 routes: / · /login · /signup · /teamlead-dashboard · /member-dashboard · /admin-dashboard
components/ui/       design-system primitives (Button, Field, Dialog, Menu, misc)
components/workspace chat, events, resources, people, notifications, search, shell
components/providers auth, toasts, notifications
lib/                 Firestore services, time-zone helpers, validation, logger, resilient listeners
firestore.rules      authorization (the trusted backend of this app)   storage.rules   file access
scripts/             migrate-legacy-data.mjs, serve-out.mjs (e2e static server)
tests/               unit · rules · e2e
docs/                AUDIT · ARCHITECTURE · OPERATIONS
```

## Design system

Semantic CSS variables in `app/globals.css` (surface / ink / line / accent / status, light + dark) are exposed to Tailwind via `@theme`.
Warm paper neutrals, an ink navigation rail and a single vermilion accent. Components never hard-code colours. Motion uses
`motion` (LazyMotion, `reducedMotion="user"`) only for dialogs, menus, toasts, view changes and new messages.
