/**
 * The Firestore emulator initialises its rules runtime lazily, so the first rules-evaluated write after boot can stall
 * for many seconds. Exercise it once with a realistic authenticated request (a valid `users` profile create that
 * runs through the same rule path as signup) so tests measure the app, not emulator boot.
 */
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const unsignedToken = (uid: string) =>
  `${b64({ alg: "none", typ: "JWT" })}.${b64({ user_id: uid, sub: uid, email: `${uid}@warmup.test`, firebase: { sign_in_provider: "password" } })}.`;

export default async function globalSetup() {
  const project = process.env.GCLOUD_PROJECT ?? "taskprox-e2e";
  const docs = `http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents`;
  const started = Date.now();
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${docs}/users?documentId=warmup`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${unsignedToken("warmup")}` },
        body: JSON.stringify({
          fields: {
            name: { stringValue: "Warm Up" },
            email: { stringValue: "warmup@warmup.test" },
            role: { stringValue: "member" },
            createdAt: { timestampValue: new Date().toISOString() },
          },
        }),
      });
      await r.text();
      break;
    } catch {
      await new Promise((res) => setTimeout(res, 1000));
    }
  }
  await fetch(`${docs}/users/warmup`, { method: "DELETE", headers: { authorization: "Bearer owner" } }).catch(() => undefined);
  console.log(`[e2e] emulator warm-up took ${Date.now() - started} ms`);
}
