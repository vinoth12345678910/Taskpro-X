import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/** Runs the real migration script against the Firestore emulator with seeded legacy-shaped data. */
describe("legacy data migration script", () => {
  it("is a dry run by default, copies to deterministic ids on --apply, and is idempotent", async () => {
    const projectId = "taskprox-rules-test";
    process.env.GCLOUD_PROJECT = projectId;
    if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("run via `npm run test:rules` (Firestore emulator required)");
    if (!getApps().length) initializeApp({ projectId });
    const db = getFirestore();
    await db.collection("team_invites").doc("legacyAutoId1").set({ code: "ABCD23", teamName: "Legacy", teamLeadId: "leadX", isActive: true });
    await db.collection("team_members").doc("legacyAutoId2").set({ uid: "leadX", teamLeadId: "leadX", userType: "TEAM_LEAD", teamName: "Legacy", name: "L", email: "l@x.test" });
    await db.collection("team_members").doc("legacyAutoId3").set({ uid: "memY", teamLeadId: "leadX", userType: "MEMBER", teamName: "Legacy", name: "M", email: "m@x.test" });

    const run = (...flags: string[]) =>
      JSON.parse(
        execFileSync("node", ["scripts/migrate-legacy-data.mjs", ...flags], { env: { ...process.env, GCLOUD_PROJECT: projectId }, encoding: "utf8" })
          .split("\n")
          .filter((l) => !l.startsWith("[") && !l.startsWith("Nothing"))
          .join("\n"),
      );

    const dry = run();
    expect(dry.mode).toBe("dry-run");
    expect(dry.invites.create).toBe(1);
    expect(dry.members.create).toBe(2);
    expect((await db.collection("team_invites").doc("ABCD23").get()).exists).toBe(false); // nothing written

    const applied = run("--apply");
    expect(applied.invites.create).toBe(1);
    expect(applied.members.create).toBe(2);
    expect((await db.collection("team_invites").doc("ABCD23").get()).data()?.teamLeadId).toBe("leadX");
    expect((await db.collection("team_members").doc("leadX_leadX").get()).data()?.userType).toBe("TEAM_LEAD");
    expect((await db.collection("team_members").doc("leadX_memY").get()).data()?.uid).toBe("memY");
    expect((await db.collection("team_members").doc("legacyAutoId3").get()).exists).toBe(true); // legacy docs untouched

    const again = run("--apply");
    expect(again.invites.create).toBe(0);
    expect(again.members.create).toBe(0);
    expect(again.members.exists).toBe(2);
  });
});
