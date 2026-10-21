#!/usr/bin/env node
/**
 * Migrates data written by the pre-upgrade TaskProX (random document ids) to the id scheme the new
 * security rules rely on. It is additive and idempotent: it only CREATES documents, never edits or deletes,
 * unless --delete-legacy is given (run that only after verifying the app against the new documents).
 *
 *   team_invites/{randomId}        -> team_invites/{CODE}                (copy)
 *   team_members/{randomId}        -> team_members/{teamLeadId}_{uid}    (copy)
 *   chat_messages / users          -> unchanged (compatible as-is)
 *
 * Usage:
 *   node scripts/migrate-legacy-data.mjs                 # dry run: prints what would change
 *   node scripts/migrate-legacy-data.mjs --apply         # creates the new documents
 *   node scripts/migrate-legacy-data.mjs --apply --delete-legacy   # also removes migrated legacy docs
 *
 * Credentials: Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS) for the project below, or set
 * FIRESTORE_EMULATOR_HOST to run against the local emulator. Test against the emulator or a copy first.
 */
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const deleteLegacy = args.has("--delete-legacy");
const projectId = process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID ?? "taskprox-58458";

initializeApp(process.env.FIRESTORE_EMULATOR_HOST ? { projectId } : { projectId, credential: applicationDefault() });
const db = getFirestore();

const stats = { invites: { create: 0, exists: 0, skipped: 0 }, members: { create: 0, exists: 0, skipped: 0 }, deleted: 0 };
const log = (...a) => console.log(apply ? "[apply]" : "[dry-run]", ...a);

async function migrate(collection, targetId, label, stat) {
  const snap = await db.collection(collection).get();
  for (const doc of snap.docs) {
    const d = doc.data();
    const id = targetId(d);
    if (!id || doc.id === id) {
      if (doc.id !== id) stat.skipped++;
      continue; // already in the new shape, or not migratable
    }
    const target = db.collection(collection).doc(id);
    if ((await target.get()).exists) {
      stat.exists++;
    } else {
      log(`${label}: ${doc.id} -> ${id}`);
      if (apply) await target.create(d);
      stat.create++;
    }
    if (apply && deleteLegacy) {
      await doc.ref.delete();
      stats.deleted++;
    }
  }
}

await migrate("team_invites", (d) => (typeof d.code === "string" && /^[A-Z0-9]{6,12}$/.test(d.code) ? d.code : null), "invite", stats.invites);
await migrate("team_members", (d) => (d.uid && d.teamLeadId ? `${d.teamLeadId}_${d.uid}` : null), "member", stats.members);

console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", projectId, ...stats }, null, 2));
if (!apply) console.log("Nothing was written. Re-run with --apply to migrate.");
