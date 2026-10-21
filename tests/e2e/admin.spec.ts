import { expect, test } from "@playwright/test";
import { newPerson, signUp, team } from "./helpers";

const docs = "http://127.0.0.1:8080/v1/projects/taskprox-e2e/databases/(default)/documents";

/** Administrator access is granted out-of-band (console / Admin SDK); the owner token plays that role here. */
async function promoteToAdmin(email: string) {
  const list = (await (await fetch(`${docs}/users?pageSize=300`, { headers: { authorization: "Bearer owner" } })).json()) as { documents: { name: string; fields: { email: { stringValue: string } } }[] };
  const found = list.documents.find((d) => d.fields.email.stringValue === email);
  if (!found) throw new Error("user not found");
  const r = await fetch(`http://127.0.0.1:8080/v1/${found.name}?updateMask.fieldPaths=role`, {
    method: "PATCH",
    headers: { authorization: "Bearer owner", "content-type": "application/json" },
    body: JSON.stringify({ fields: { role: { stringValue: "admin" } } }),
  });
  expect(r.ok).toBe(true);
}

test("self-service signup can never produce an administrator; admins (granted out-of-band) see the overview; others are redirected", async ({ browser }) => {
  const { lead, teamName } = await team(browser);

  // a regular lead can't open the admin screen
  await lead.page.goto("/admin-dashboard");
  await expect(lead.page).toHaveURL(/teamlead-dashboard/);

  // an account that signs up with the legacy "admin e-mail" gets no special treatment any more
  const sneaky = await newPerson(browser, "Sneaky");
  sneaky.email = "va3490@srmist.edu.in".replace("va3490", `va3490${Date.now()}`); // same domain pattern, unique
  await signUp(sneaky, "member");
  await sneaky.page.goto("/admin-dashboard");
  await expect(sneaky.page).toHaveURL(/member-dashboard/);

  // after an operator promotes an account, it lands on the admin overview and sees teams + accounts
  const admin = await newPerson(browser, "Ada Admin");
  await signUp(admin, "member");
  await promoteToAdmin(admin.email);
  await admin.page.goto("/login");
  await admin.page.reload();
  await admin.page.goto("/admin-dashboard");
  await expect(admin.page.getByRole("heading", { name: "Administration" })).toBeVisible({ timeout: 20_000 });
  await expect(admin.page.getByText(teamName)).toBeVisible();
  await expect(admin.page.getByText(lead.email).first()).toBeVisible();
});
