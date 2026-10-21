import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

let counter = 0;
export const uniq = (p: string) => `${p}-${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export interface Person {
  errors: string[];
  ctx: BrowserContext;
  page: Page;
  name: string;
  email: string;
}

export async function newPerson(browser: Browser, name: string, opts: { timezoneId?: string } = {}): Promise<Person> {
  const ctx = await browser.newContext({ timezoneId: opts.timezoneId, locale: "en-US" });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (c) => c.type() === "error" && errors.push(c.text().slice(0, 400)));
  return { errors, ctx, page, name, email: `${uniq(name.toLowerCase().replace(/\W+/g, ""))}@example.test` };
}

export async function signUp(p: Person, role: "member" | "team_lead") {
  await p.page.goto("/signup");
  await p.page.getByLabel("Full name").fill(p.name);
  await p.page.getByLabel("Email").fill(p.email);
  await p.page.locator("input[name=password]").fill("correct-horse-9");
  await p.page.getByText(role === "team_lead" ? "Team lead" : "Team member", { exact: true }).click();
  await p.page.getByRole("button", { name: "Create account" }).click();
  await expect(p.page).toHaveURL(role === "team_lead" ? /teamlead-dashboard/ : /member-dashboard/, { timeout: 25_000 });
}

export async function signIn(p: Person) {
  await p.page.goto("/login");
  await p.page.getByLabel("Email").fill(p.email);
  await p.page.locator("input[name=password]").fill("correct-horse-9");
  await p.page.getByRole("button", { name: "Sign in" }).click();
}

export async function createTeam(lead: Person, teamName: string): Promise<string> {
  await lead.page.getByLabel("Team name").fill(teamName);
  await lead.page.getByRole("button", { name: "Create team" }).click();
  await expect(lead.page.getByRole("log", { name: `${teamName} conversation` })).toBeVisible();
  await lead.page.getByRole("button", { name: "People" }).first().click();
  const code = (await lead.page.getByTestId("invite-code").textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{8}$/);
  await lead.page.getByRole("button", { name: "Chat" }).first().click();
  return code;
}

export async function joinTeam(member: Person, code: string, teamName: string) {
  await member.page.getByLabel("Invite code").fill(code);
  await member.page.getByRole("button", { name: "Join team" }).click();
  await expect(member.page.getByRole("log", { name: `${teamName} conversation` })).toBeVisible();
}

/** Lead + member sharing one team, each in their own browser context (= two real clients). */
export async function team(browser: Browser, opts: { leadTz?: string; memberTz?: string } = {}) {
  const teamName = uniq("Team");
  const lead = await newPerson(browser, "Lena Lead", { timezoneId: opts.leadTz });
  const member = await newPerson(browser, "Milo Member", { timezoneId: opts.memberTz });
  await signUp(lead, "team_lead");
  const code = await createTeam(lead, teamName);
  await signUp(member, "member");
  await joinTeam(member, code, teamName);
  // Wait until both clients have the full roster (the first snapshot after joining can come from the local cache).
  for (const p of [lead, member]) {
    if ((p.page.viewportSize()?.width ?? 1280) < 768) {
      await p.page.waitForTimeout(2500); // the roster count lives in the desktop rail only
      continue;
    }
    await expect(p.page.getByText(/of 2 online/).first(), `roster on ${p.name}'s client: errors ${JSON.stringify(p.errors)}`).toBeVisible();
  }
  return { lead, member, teamName, code };
}

export async function send(p: Person, teamName: string, text: string) {
  const box = p.page.getByLabel(`Message ${teamName}`);
  await box.fill(text);
  await box.press("Enter");
}

export const go = (p: Person, view: "Chat" | "Events" | "Resources" | "People") =>
  p.page.getByRole("navigation", { name: "Primary" }).first().getByRole("button", { name: view }).click();
