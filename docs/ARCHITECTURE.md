# Architecture

## Runtime
* Next.js 15 App Router, `output: "export"` → static files on **Firebase Hosting**. No server code runs at request time.
* Firebase Auth (email/password), Cloud Firestore (data + real time), Cloud Storage (files).
* Vercel and Socket.IO are **not** part of this system. A persistent socket server cannot run on static hosting, and Firestore already
  provides authenticated, resumable, offline-tolerant listeners, so a second real-time transport would only add a second source of truth.
  `socket.io-client` (never imported) was removed.

## Source of truth per data type
| Data | Collection | Notes |
| --- | --- | --- |
| Profile / role | `users/{uid}` | `role` is `member` or `team_lead`, immutable after creation. `admin` exists only if set in the console. |
| Team | the lead's `team_members/{leadUid}_{leadUid}` | **team id = lead uid** (one team per lead, as before). |
| Membership | `team_members/{teamId}_{uid}` | Deterministic id so rules can check membership with `exists()`. Fields unchanged from the old model, plus optional `prefs`, `inviteCode`. |
| Invite | `team_invites/{CODE}` | Doc id **is** the code (8 chars, no `0/O/1/I`). `get` by id works, listing is leads-only, so codes cannot be enumerated. |
| Messages | `chat_messages/{id}` | `roomId = teamId` (unchanged). Adds `replyCount`, `lastReplyAt`, `reactions`, `mentions`, `editedAt`, `deleted`. |
| Replies | `chat_messages/{id}/replies/{rid}` | Subcollection so channel pagination is not polluted by replies. |
| Events | `events/{id}` | `startAt` / `endAt` **UTC Timestamps**, `timeZone` (IANA, the zone the lead typed in), `status`. |
| Notifications | `notifications/{type_key_recipient}` | Deterministic id ⇒ a retry cannot duplicate. Only the recipient can read / mark read. |
| Resources | `resources/{id}` (+ Storage `teams/{teamId}/resources/{id}/{file}`) | Metadata size/type are read back from Storage, not trusted from the browser. |
| Presence | `presence/{teamId}_{uid}` | Heartbeat each 60 s while the tab is open; "online" = heartbeat < 2.5 min old. |

## Authorization (firestore.rules / storage.rules)
The browser is untrusted, so the rules are the backend:
* Identity only from `request.auth`. Team membership = `exists(team_members/{teamId}_{uid})`. Lead = `uid == teamId`.
* Roles cannot be self-assigned above member/team_lead and cannot change; no client path creates an admin.
* A member joins only by presenting an **active** invite whose team/name match the membership being created.
* Messages: only members read/write their team's room; author is pinned to `request.auth.uid`; timestamps pinned to `request.time`;
  edit = author only (text/edited fields), delete = soft-delete by author or lead, no hard deletes; reactions only modify the caller's own key;
  `replyCount` may only go up by exactly 1 together with `lastReplyAt`.
* Events: members read; **only the team lead** creates / updates / deletes; `endAt > startAt`, ≤ 14 days, schema-checked.
* Notifications: created by a teammate for a teammate, `actor.uid == auth.uid`, event notices only by the lead; recipient may flip `read` only.
* Resources: members create; owner or lead edit/delete; links must be `http(s)`; files ≤ 10 MB with a storage path inside the team folder.
* Storage: members read; create requires size ≤ 10 MB, allow-listed content type (no SVG/HTML/JS), `uploadedBy == auth.uid`;
  delete by uploader or lead.
* Everything else is denied by default (including the legacy `room_messages`).

Verified by 35 emulator tests (`tests/rules`), including cross-team isolation and the failure modes above.

**What rules cannot do** (documented limits): rate-limit writes, or send notifications "on behalf of the server". A teammate could therefore create
spurious notifications for another teammate in the same team (never cross-team, never as another person). Enable **Firebase App Check** and,
if needed, move notification fan-out into a Cloud Function (requires the Blaze plan).

## Real-time behaviour
* One listener per data type per team, created in `TeamProvider`, cleaned up on unmount / team switch; each is wrapped by `resilient()`
  (exponential back-off re-subscribe, then an error state with a retry button).
* Messages: live window of the newest 40 + manual "load earlier" pages; messages that slide out of the live window are kept (we never hard delete).
* Sending: the id is minted before the write (`doc(collection)`) and kept until success, so a retry / reconnect / double submit writes the **same**
  document. Firestore's local write queue delivers it after reconnect; the UI shows "Sending…" until the server acknowledges.
* The signed-in profile is trusted only after the server confirms it (`hasPendingWrites` ignored) so a mid-signup abort cannot look like success.

## Event time model
Stored: absolute instants (UTC) + the author's IANA zone. Input: `datetime-local` wall-clock text interpreted **in the chosen zone**
(`lib/datetime.ts`, Intl-based, no dependency). Spring-forward gaps are rejected; fall-back repeats resolve to the first occurrence and warn.
Display: in the viewer's zone, with a "where it was scheduled" note when zones differ. Root cause of the original bug and the regression tests:
see `docs/AUDIT.md`.

## Observability
`lib/logger.ts` writes one JSON line per event (scope, message, ids, error code), redacts secret-looking keys and message bodies, and exposes
`setErrorReporter()` as the hook for an error-reporting service (none is bundled; adding a paid service needs approval).
No health endpoint exists because there is no server; Hosting + Firebase status pages are the operational signals.
