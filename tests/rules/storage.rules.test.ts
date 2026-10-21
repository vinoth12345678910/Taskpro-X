import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import { doc, setDoc, Timestamp } from "firebase/firestore";

/* eslint-disable @typescript-eslint/no-explicit-any */
let env: RulesTestEnvironment;
const LEAD = "lead1";
const BOB = "bob";
const CAROL = "carol"; // member of another team
const bytes = (n: number) => new Uint8Array(n).fill(7);
const path = (team: string, id: string, name = "a.pdf") => `teams/${team}/resources/${id}/${name}`;
const st = (uid: string): any => env.authenticatedContext(uid).storage();
const meta = (uid: string, contentType = "application/pdf") => ({ contentType, customMetadata: { uploadedBy: uid } });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "taskprox-rules-test",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
    storage: { rules: readFileSync("storage.rules", "utf8") },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db: any = ctx.firestore();
    const member = (team: string, uid: string, userType: string) =>
      setDoc(doc(db, "team_members", `${team}_${uid}`), { uid, teamLeadId: team, userType, name: uid, email: `${uid}@x.test`, teamName: "T", joinedAt: Timestamp.now() });
    await Promise.all([member(LEAD, LEAD, "TEAM_LEAD"), member(LEAD, BOB, "MEMBER"), member("lead2", "lead2", "TEAM_LEAD"), member("lead2", CAROL, "MEMBER")]);
  });
});
afterAll(async () => env?.cleanup());

describe("storage rules for shared resources", () => {
  it("team members can upload allowed files and read them back; the uploader is recorded", async () => {
    await assertSucceeds(uploadBytes(ref(st(BOB), path(LEAD, "r1")), bytes(1024), meta(BOB)));
    await assertSucceeds(getBytes(ref(st(LEAD), path(LEAD, "r1"))));
    await assertSucceeds(uploadBytes(ref(st(LEAD), path(LEAD, "r2", "b.docx")), bytes(10), meta(LEAD, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")));
  });

  it("other teams and signed-out users can neither read nor write", async () => {
    await assertFails(getBytes(ref(st(CAROL), path(LEAD, "r1"))));
    await assertFails(uploadBytes(ref(st(CAROL), path(LEAD, "r3")), bytes(10), meta(CAROL)));
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage() as any, path(LEAD, "r1"))));
  });

  it("rejects oversize files, unsafe types (svg/html/js) and uploads that claim someone else as uploader", async () => {
    await assertFails(uploadBytes(ref(st(BOB), path(LEAD, "big")), bytes(10 * 1024 * 1024 + 1), meta(BOB)));
    await assertFails(uploadBytes(ref(st(BOB), path(LEAD, "svg", "x.svg")), bytes(10), meta(BOB, "image/svg+xml")));
    await assertFails(uploadBytes(ref(st(BOB), path(LEAD, "html", "x.html")), bytes(10), meta(BOB, "text/html")));
    await assertFails(uploadBytes(ref(st(BOB), path(LEAD, "js", "x.js")), bytes(10), meta(BOB, "application/javascript")));
    await assertFails(uploadBytes(ref(st(BOB), path(LEAD, "spoof")), bytes(10), meta(LEAD)));
    await assertFails(uploadBytes(ref(st(BOB), `teams/${LEAD}/elsewhere/x.pdf`), bytes(10), meta(BOB)));
  });

  it("only the uploader or the team lead may delete", async () => {
    await assertSucceeds(uploadBytes(ref(st(BOB), path(LEAD, "d1")), bytes(10), meta(BOB)));
    await assertFails(deleteObject(ref(st(CAROL), path(LEAD, "d1"))));
    await assertSucceeds(deleteObject(ref(st(BOB), path(LEAD, "d1"))));
    await assertSucceeds(uploadBytes(ref(st(BOB), path(LEAD, "d2")), bytes(10), meta(BOB)));
    await assertSucceeds(deleteObject(ref(st(LEAD), path(LEAD, "d2"))));
    await assertSucceeds(uploadBytes(ref(st(LEAD), path(LEAD, "d3")), bytes(10), meta(LEAD)));
    await assertFails(deleteObject(ref(st(BOB), path(LEAD, "d3")))); // a different member's file
  });
});
