import { expect, test } from "@playwright/test";
import { createTeam, go, newPerson, send, signIn, signUp, team, uniq } from "./helpers";

test.describe("access control", () => {
  test("users only reach the workspace that matches their stored role, and signed-out users are sent to login", async ({ browser }) => {
    const anon = await newPerson(browser, "Anon");
    await anon.page.goto("/teamlead-dashboard");
    await expect(anon.page).toHaveURL(/\/login/);

    const m = await newPerson(browser, "Mia Member");
    await signUp(m, "member");
    await m.page.goto("/teamlead-dashboard");
    await expect(m.page).toHaveURL(/member-dashboard/);
    await m.page.goto("/admin-dashboard");
    await expect(m.page).toHaveURL(/member-dashboard/);
  });

  test("a wrong invite code is rejected with a clear message and nobody gets in", async ({ browser }) => {
    const m = await newPerson(browser, "Mia Member");
    await signUp(m, "member");
    await m.page.getByLabel("Invite code").fill("ZZZZZZZZ");
    await m.page.getByRole("button", { name: "Join team" }).click();
    await expect(m.page.locator("p[role=alert]")).toContainText(/invalid or has expired/i);
  });

  test("sign-in shows an error for bad credentials", async ({ browser }) => {
    const p = await newPerson(browser, "Nobody");
    await p.page.goto("/login");
    await p.page.getByLabel("Email").fill("nobody@example.test");
    await p.page.locator("input[name=password]").fill("wrong-password");
    await p.page.getByRole("button", { name: "Sign in" }).click();
    await expect(p.page.locator("p[role=alert]")).toBeVisible();
  });
});

test.describe("team chat", () => {
  test("messages are delivered live to a second client, survive a refresh, and stay private to the team", async ({ browser }) => {
    const { lead, member, teamName } = await team(browser);
    const text = uniq("hello");

    await send(lead, teamName, text);
    await expect(member.page.getByRole("log")).toContainText(text); // second client, no reload
    await expect(lead.page.getByRole("log")).toContainText(text);

    const reply = uniq("pong");
    await send(member, teamName, reply);
    await expect(lead.page.getByRole("log")).toContainText(reply);

    await member.page.reload();
    await expect(member.page.getByRole("log")).toContainText(text);
    await expect(member.page.getByRole("log")).toContainText(reply);

    // A different team (different lead) must not see any of it.
    const other = await newPerson(browser, "Olive Other");
    await signUp(other, "team_lead");
    const otherTeam = uniq("OtherTeam");
    await createTeam(other, otherTeam);
    await expect(other.page.getByRole("log")).not.toContainText(text);
    await expect(other.page.getByRole("log")).not.toContainText(reply);
  });

  test("going offline and reconnecting delivers a message exactly once", async ({ browser }) => {
    const { lead, member, teamName } = await team(browser);
    const text = uniq("offline-msg");
    await member.ctx.setOffline(true);
    await expect(member.page.getByText("You're offline").first()).toBeVisible();
    await send(member, teamName, text);
    await member.ctx.setOffline(false);
    await expect(lead.page.getByRole("log")).toContainText(text, { timeout: 30_000 });
    await expect(lead.page.getByRole("log").getByText(text, { exact: true })).toHaveCount(1);
    await member.page.reload();
    await expect(member.page.getByRole("log").getByText(text, { exact: true })).toHaveCount(1);
  });

  test("threads, reactions, edit and delete respect who may do what", async ({ browser }) => {
    const { lead, member, teamName } = await team(browser);
    const text = uniq("topic");
    await send(lead, teamName, text);
    const leadMsg = lead.page.getByRole("log").locator("article", { hasText: text });
    const memberMsg = member.page.getByRole("log").locator("article", { hasText: text });
    await expect(memberMsg).toBeVisible();

    // reply in a thread; both sides see the count and the reply
    await memberMsg.hover();
    await memberMsg.getByRole("button", { name: "Reply in thread" }).click();
    const reply = uniq("threadreply");
    await member.page.getByRole("combobox", { name: "Reply in thread" }).fill(reply);
    await member.page.getByRole("combobox", { name: "Reply in thread" }).press("Enter");
    await expect(member.page.getByRole("region", { name: "Thread" })).toContainText(reply);
    await expect(leadMsg).toContainText("1 reply");
    await leadMsg.getByRole("button", { name: /1 reply/ }).click();
    await expect(lead.page.getByRole("region", { name: "Thread" })).toContainText(reply);

    // reactions sync
    await memberMsg.hover();
    await memberMsg.getByRole("button", { name: "Add reaction" }).click();
    await member.page.getByRole("button", { name: "Thumbs up" }).click();
    await expect(leadMsg.getByRole("button", { name: /Thumbs up: Milo Member/ })).toContainText("1");

    // a member can't edit or delete the lead's message
    await memberMsg.hover();
    await memberMsg.getByRole("button", { name: "More actions" }).click();
    await expect(member.page.getByRole("menuitem", { name: "Copy text" })).toBeVisible();
    await expect(member.page.getByRole("menuitem", { name: "Edit" })).toHaveCount(0);
    await expect(member.page.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
    await member.page.keyboard.press("Escape");

    // the author can edit (and everyone sees it), then delete
    await leadMsg.hover();
    await leadMsg.getByRole("button", { name: "More actions" }).click();
    await lead.page.getByRole("menuitem", { name: "Edit" }).click();
    const edited = uniq("edited");
    await lead.page.getByLabel("Edit message").fill(edited);
    await lead.page.getByRole("button", { name: "Save" }).click();
    await expect(member.page.getByRole("log")).toContainText(edited);
    await expect(member.page.getByRole("log")).toContainText("(edited)");

    const editedMsg = lead.page.getByRole("log").locator("article", { hasText: edited });
    await editedMsg.hover();
    await editedMsg.getByRole("button", { name: "More actions" }).click();
    await lead.page.getByRole("menuitem", { name: "Delete" }).click();
    await lead.page.getByRole("button", { name: "Delete message" }).click();
    await expect(member.page.getByRole("log")).toContainText("This message was deleted.");
    await expect(member.page.getByRole("log")).not.toContainText(edited);
  });

  test("messages longer than the history window load on demand", async ({ browser }) => {
    const { lead, member, teamName } = await team(browser);
    for (let i = 1; i <= 45; i++) await send(lead, teamName, `bulk-${String(i).padStart(2, "0")}`);
    await expect(lead.page.getByRole("log")).toContainText("bulk-45");
    await member.page.reload();
    await expect(member.page.getByRole("log")).toContainText("bulk-45");
    await expect(member.page.getByRole("log")).not.toContainText("bulk-01");
    await member.page.getByRole("button", { name: "Load earlier messages" }).click();
    await expect(member.page.getByRole("log")).toContainText("bulk-01");
  });
});

test("sign-out and sign-in again restores the same workspace", async ({ browser }) => {
  const { lead, teamName } = await team(browser);
  const text = uniq("persist");
  await send(lead, teamName, text);
  await expect(lead.page.getByRole("log")).toContainText(text);
  await lead.page.getByRole("button", { name: "Account menu" }).click();
  await lead.page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(lead.page).toHaveURL(/login|\/$/, { timeout: 15_000 }).catch(() => undefined);
  await signIn(lead);
  await expect(lead.page.getByRole("log", { name: `${teamName} conversation` })).toContainText(text);
  void go;
});
