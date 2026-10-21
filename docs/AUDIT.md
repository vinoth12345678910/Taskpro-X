# TaskProX — Phase 1 audit and baseline

Audit date: 2026-10-21. Baseline commit: `92a268b` (`main`). Work branch: `claude/lucid-dirac-mhqhrp`.

## 1. What the application actually is

| Area | Finding |
| --- | --- |
| Framework | Next.js 15.3.5, **App Router**, React 19, TypeScript (strict), Tailwind CSS 4, npm (`package-lock.json`) |
| Rendering | `output: "export"` (static export). **There is no Node server at runtime.** |
| Hosting | Firebase Hosting (`firebase.json`, `.firebaserc` → `taskprox-58458`). The README mentions Vercel; no Vercel config exists in the repo. |
| Backend | Firebase Auth (email/password) + Cloud Firestore, called directly from the browser. `functions/` is the untouched Firebase scaffold (no exported function). Storage is initialised in `utils/firebase.js` but never used; there are no Storage rules. |
| Real-time | Firestore `onSnapshot` only. **Socket.IO is not used anywhere**: `socket.io-client` is in `package.json` but is imported nowhere, and there is no socket server in the repo (README describes a `server/` directory that does not exist; it also mentions Redis and a Realtime Database, neither is present). |
| CI | One workflow: Firebase Hosting preview on PR (`npm install && npm run build`). No lint, type-check or test step. |
| Tests | None. |

## 2. Routes and features (must stay backward compatible)

| Route | Purpose |
| --- | --- |
| `/` | Marketing landing page (contains invented testimonials/ratings). |
| `/signup` | Email/password signup, role = `member` \| `team_lead` chosen **by the client**; `va3490@srmist.edu.in` is hard-coded as admin **on the client**. Writes `users/{uid}`. |
| `/login` | Email/password login, reads `users/{uid}.role`, redirects to a dashboard. |
| `/teamlead-dashboard` | Create team (writes `team_invites` + `team_members`), invite code, member list/remove, **events (local React state only)**, team chat. |
| `/member-dashboard` | Join team by invite code, team chat, **events list that is never populated**. |
| `/admin-dashboard` | Lists all `team_invites` and `users`. |

### Firestore data model (as found)

* `users/{uid}`: `name, email, role (member|team_lead|admin), createdAt`, plus `userType, lastLogin` merged in by dashboards.
* `team_invites/{autoId}`: `code, teamName, teamLeadId, teamLeadName, teamLeadEmail, createdAt, isActive`.
* `team_members/{autoId}`: `uid, name, email, userType (TEAM_LEAD|MEMBER), teamLeadId, teamLeadName, teamLeadEmail, teamName, joinedAt`.
* `chat_messages/{autoId}`: `roomId (= teamLeadId), text, timestamp (serverTimestamp), author{uid,name,email,userType}`.
* `room_messages` is read by the orphaned `FirestoreTeamChat.js` (unused component).
* Index: `chat_messages (roomId ASC, timestamp ASC)`.

## 3. Baseline results (before any change)

| Check | Result |
| --- | --- |
| `npm ci` | OK |
| `npx tsc --noEmit` | **Pass** |
| `npx next lint` | **Fail, 25 errors / 2 warnings** (`no-explicit-any`, unused vars, unescaped entities, missing hook deps). Pre-existing; `next.config.ts` sets `eslint.ignoreDuringBuilds`. |
| `npm run build` | **Pass** (7 static routes) |
| Tests | none exist |

## 4. Defects found, with evidence and root cause

### D1 — Event scheduling does not work (highest priority)
* **Evidence:** `app/teamlead-dashboard/page.tsx:20` `const [events, setEvents] = useState([])`; the form handler only calls `setEvents([...events, …])`. There is no Firestore write or read for events anywhere in the repo. `app/member-dashboard/page.tsx:17` declares `events` and never sets it (lint flags `setEvents` unused).
* **Root cause:** events are held in component memory only. They vanish on refresh, are invisible to every other user, and members can never see them. The form also takes a date with no time, no end, and no time zone.
* **Fix direction:** `events` collection with UTC `Timestamp`s + the IANA zone it was authored in, start/end validation, idempotent create (client-generated doc id), lead-only writes enforced by security rules, real-time subscription for all members, cancel instead of hard delete.

### D2 — Authorization is effectively absent
* `firestore.rules` is `allow read, write: if request.auth != null` for **every** document. Any signed-in user can read every team's private chat, read all users' emails, rewrite any `users/{uid}.role` (including to `admin`), write into any room as anyone, and delete any membership.
* Roles are chosen by the client at signup; admin by a client-side e-mail comparison.
* Invite codes are discoverable by listing `team_invites`.
* Team membership is looked up by query, so rules cannot verify it (auto-ID documents).
* Dashboards do not verify the signed-in user's stored role (a member can open `/teamlead-dashboard`).

### D3 — Real-time architecture claims do not match the code
* Socket.IO is advertised but absent. Static hosting cannot run a persistent socket server, so adding one would require new infrastructure for no benefit. **Decision:** Firestore is the single transport and source of truth; the unused dependency is removed.
* `FirestoreChat` subscribes to **all** messages of a room with no limit (unbounded reads), shows `alert()` on failure, and has no retry-safe send (a retry would create a duplicate).
* Orphaned duplicate component `FirestoreTeamChat.js` targets a different collection (`room_messages`).

### D4 — Other
* `tsconfig.json` `include` references non-existent files.
* `localStorage` used for display name/role (spoofable; harmless only because it is not trusted for authz).
* Admin dashboard reads `localStorage` during render and fires queries before auth resolves (permission error once rules are tightened).
* Landing page presents fabricated testimonials as real.
* `alert()`/`window.confirm()` for all feedback; page metadata is still "Create Next App".
* No `lang`/focus/keyboard/aria work; heavy gradient/glass styling.

## 5. Constraints that shape the design

* Static export ⇒ no server-side code. Anything "trusted" must be Firestore/Storage **security rules** (testable with the emulator) or Cloud Functions.
* Cloud Functions require the Blaze plan and a deploy; they are not enabled. Therefore **durable event reminders cannot be shipped safely** and are documented as a blocker rather than faked with browser timers.
* Firebase Storage may require the Blaze plan on the project; file upload is implemented against Storage with rules, and link resources work on Firestore alone.
* No credentials are available in this environment: nothing is deployed, rules are **not** published, and production data is not touched. Verification uses the local Firebase emulators.

## 6. Acceptance criteria (what "done" means here)

1. Events: create / read / edit / cancel persist across reload and are visible live to all members; DST-correct display; end > start; double submit creates one event; a non-lead cannot write (rules test).
2. Chat: cross-team read denied (rules test); two clients see the same messages; retry does not duplicate; paginated history; threads, reactions, edit/delete with permissions.
3. Notifications persisted, per-recipient, deduplicated, mark read / all read, preferences.
4. Shared resources (links + files) restricted to team members.
5. `tsc`, `eslint`, unit tests, rules tests, Playwright e2e and `next build` all run and reported accurately.
6. Existing routes and the `users`, `team_members`, `team_invites`, `chat_messages` collections keep working; legacy-data migration documented.
