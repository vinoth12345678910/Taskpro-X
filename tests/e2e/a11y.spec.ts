import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { go, send, team, newPerson, uniq } from "./helpers";

const scan = async (page: Page, label: string) => {
  await page.waitForTimeout(400); // let enter/exit transitions finish: axe would otherwise measure contrast mid-fade
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`),
    `axe violations on ${label}`,
  ).toEqual([]);
};

for (const scheme of ["light", "dark"] as const) {
  test(`public pages have no serious accessibility violations (${scheme})`, async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: scheme });
    const page = await ctx.newPage();
    for (const path of ["/", "/login", "/signup"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await scan(page, `${path} (${scheme})`);
    }
  });

  test(`workspace screens have no serious accessibility violations (${scheme})`, async ({ browser }) => {
    test.setTimeout(120_000);
    const { lead, teamName } = await team(browser);
    await lead.page.emulateMedia({ colorScheme: scheme });
    await send(lead, teamName, `${uniq("a11y")} hello @Milo Member`);
    await expect(lead.page.getByRole("log")).toContainText("a11y");
    await scan(lead.page, `chat (${scheme})`);

    await go(lead, "Events");
    await lead.page.getByRole("button", { name: "New event" }).click();
    await lead.page.getByLabel("Title").fill("Design review");
    await lead.page.getByLabel("Starts").fill("2027-04-01T10:00");
    await lead.page.getByLabel("Ends").fill("2027-04-01T11:00");
    await scan(lead.page, `event dialog (${scheme})`);
    await lead.page.getByRole("button", { name: "Schedule event" }).click();
    await expect(lead.page.locator("li", { hasText: "Design review" })).toBeVisible();
    await scan(lead.page, `events upcoming (${scheme})`);
    await lead.page.getByRole("tab", { name: "Calendar" }).click();
    await scan(lead.page, `events calendar (${scheme})`);

    await go(lead, "Resources");
    await scan(lead.page, `resources empty (${scheme})`);
    await go(lead, "People");
    await scan(lead.page, `people (${scheme})`);

    await lead.page.getByRole("button", { name: /Notifications/ }).click();
    await scan(lead.page, `notifications panel (${scheme})`);
    await lead.page.keyboard.press("Escape");
    await lead.page.keyboard.press("Control+k");
    await scan(lead.page, `search palette (${scheme})`);
    void newPerson;
  });
}
