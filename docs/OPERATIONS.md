# Operations: configuration, rollout, rollback, limits

Nothing in this repository deploys itself to production. Every step below is performed by a person with access to the Firebase project
`taskprox-58458` (`.firebaserc`).

## Configuration
| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_*` (6 values) | build time, optional | Override the Firebase web config (defaults = production project). Public by design. |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=1` | test builds only | Points the SDK at local emulators. **Never set for production** (`npm run build:e2e` sets it; `npm run build` does not). |
| `GCLOUD_PROJECT`, `GOOGLE_APPLICATION_CREDENTIALS` | migration script only | Admin credentials stay on the operator's machine, never in the repo or browser bundle. |
| `PW_CHROMIUM_PATH` | tests, optional | Use a pre-installed Chromium for Playwright. |

Firebase console prerequisites: Authentication → Email/Password enabled; Firestore in Native mode; **Storage enabled** (new buckets require the
Blaze plan — without it, files cannot be uploaded but links, chat and events work); `cors.json` is for Storage download CORS if you need it.

## Rollout (staged, reversible until step 5)
1. **Staging first.** Create a second Firebase project, build with the `NEXT_PUBLIC_FIREBASE_*` overrides, deploy rules + hosting there, and run through the flows.
2. **Review.** Merge the PR only after `npm run check` and `npm run test:e2e` pass in CI.
3. **Migrate legacy data (additive).**
   ```bash
   export GCLOUD_PROJECT=taskprox-58458 GOOGLE_APPLICATION_CREDENTIALS=/secure/path/key.json
   node scripts/migrate-legacy-data.mjs            # dry run – review the output
   node scripts/migrate-legacy-data.mjs --apply    # copies invites → id=code, memberships → {teamId}_{uid}
   ```
   Legacy documents are left in place, so the old app keeps working until step 5. Chat messages and users need no migration.
4. **Indexes.** `firebase deploy --only firestore:indexes` and wait until they show *Enabled* (new composite indexes: events, notifications, resources).
5. **Cut over (the point of no easy return).** Deploy rules and hosting **together** so the new app and the new rules arrive at the same time:
   `npm run build && firebase deploy --only firestore:rules,storage,hosting`.
   The old app cannot work with the new rules (its random-id memberships are invisible to them) — that is the security fix.
6. Optional cleanup after a stable week: `node scripts/migrate-legacy-data.mjs --apply --delete-legacy`.

### Admin access
Signup can no longer create administrators (the old client-side e-mail check is gone). To grant admin: Firebase console → Firestore →
`users/{uid}` → set `role` to `admin`. Existing admin profiles that already have `role: "admin"` keep working.

## Rollback
* **App:** Firebase console → Hosting → *Rollback* to the previous release, or `git revert` the merge and redeploy.
* **Rules:** `git show 92a268b:firestore.rules > firestore.rules` and deploy. Be aware that the old rules are fully open to any signed-in user.
* **Data:** the migration only adds documents (new ids); the old documents are still there unless `--delete-legacy` was used, so the old app works
  after a rollback. Documents created by the new app (events, notifications, resources, presence, replies) are ignored by the old app.

## Known limitations and remaining work
| Item | Status | What is needed |
| --- | --- | --- |
| Upcoming-event **reminders** | **Not implemented** | Needs a durable scheduler. Browser timers die with the tab, and static hosting has no server. Implement a scheduled Cloud Function (Blaze plan) that scans `events` and writes `notifications`; deploy `functions/`. Not faked here. |
| Direct messages | Not implemented | The existing product is team-room based; DMs are a separate feature. |
| Search | Current team only, messages = already-loaded history | Firestore has no full-text search. Use Algolia/Typesense or a Cloud Function index if full history search is required. |
| Unread message markers | Per device (`localStorage`) | Store `lastRead` per user in Firestore if cross-device sync matters. |
| Spam / abuse limits | Not enforceable in rules | Enable App Check; consider Cloud Functions for fan-out and rate limits. |
| Email verification | Not enforced | Add `sendEmailVerification` + a rules check on `request.auth.token.email_verified`. |
| Browser push notifications | Not implemented | Requires FCM + service worker + VAPID key; deliberately out of scope. |
| Lottie / illustration animation | Not added | Motion is limited to purposeful UI transitions (dialogs, menus, toasts, messages). No extra dependency was justified. |
| Multi-day events on the calendar | Marked on their start day only | Display-only limitation. |
| Presence | Costs one small write per minute per open tab | Move to Realtime Database `onDisconnect` if cost matters. |
