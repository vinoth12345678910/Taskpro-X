import { expect, test } from "@playwright/test";
import { team, uniq, send } from "./helpers";

test("mobile layout: bottom navigation, no horizontal scroll, chat and events usable", async ({ browser }) => {
  const { lead, teamName } = await team(browser);
  const page = lead.page;
  const bottom = page.getByRole("navigation", { name: "Primary" }).last();
  await expect(bottom).toBeVisible();

  const text = uniq("mobile");
  await send(lead, teamName, text);
  await expect(page.getByRole("log")).toContainText(text);

  for (const view of ["Events", "Resources", "People", "Chat"]) {
    await bottom.getByRole("button", { name: view }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on ${view}`).toBeLessThanOrEqual(1);
  }

  // thread opens as a full-height sheet on small screens
  const msg = page.getByRole("log").locator("article", { hasText: text });
  await msg.getByText(text).tap(); // on touch devices actions appear when a message is tapped
  await msg.getByRole("button", { name: "Reply in thread" }).tap();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Reply in thread" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("empty state, error recovery and offline banner copy are reachable", async ({ browser }) => {
  const { lead } = await team(browser);
  await lead.page.getByRole("navigation", { name: "Primary" }).last().getByRole("button", { name: "Events" }).click();
  await expect(lead.page.getByText("Nothing scheduled")).toBeVisible();
  await lead.ctx.setOffline(true);
  await expect(lead.page.getByText("Offline", { exact: true })).toBeVisible();
  await lead.ctx.setOffline(false);
});
