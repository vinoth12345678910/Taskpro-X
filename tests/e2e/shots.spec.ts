import { test } from "@playwright/test";
import { go, send, team, uniq } from "./helpers";
const OUT = process.env.SHOTS_DIR!;
test.skip(!process.env.SHOTS_DIR, "screenshots only on demand");

test("screens", async ({ browser }) => {
  test.setTimeout(180_000);
  const { lead, member, teamName } = await team(browser, { leadTz: "America/New_York", memberTz: "Asia/Kolkata" });
  await lead.page.setViewportSize({ width: 1440, height: 900 });
  await member.page.setViewportSize({ width: 1440, height: 900 });
  const convo: [typeof lead, string][] = [
    [lead, "Morning all — sprint planning is on the calendar. Please skim the roadmap doc first."],
    [member, "Thanks @Lena Lead! I'll add my estimates before the meeting."],
    [lead, "Great. Anyone blocked on the design review?"],
    [member, "Not blocked, but I'd like a second pair of eyes on the onboarding flow."],
  ];
  for (const [p, t] of convo) await send(p, teamName, t);
  await lead.page.waitForTimeout(1500);
  const m1 = lead.page.getByRole("log").locator("article", { hasText: "second pair of eyes" });
  await m1.hover();
  await m1.getByRole("button", { name: "Add reaction" }).click();
  await lead.page.getByRole("button", { name: "Thumbs up" }).click();
  await m1.hover();
  await m1.getByRole("button", { name: "Reply in thread" }).click();
  await lead.page.getByRole("combobox", { name: "Reply in thread" }).fill("Happy to — send me the link.");
  await lead.page.getByRole("combobox", { name: "Reply in thread" }).press("Enter");
  await lead.page.waitForTimeout(800);
  await lead.page.screenshot({ path: `${OUT}/chat-thread-light.png` });

  await go(lead, "Events");
  for (const [t, s, e] of [["Sprint planning", "2027-03-03T10:00", "2027-03-03T11:30"], ["Design review", "2027-03-04T14:00", "2027-03-04T15:00"], ["Retro", "2027-03-05T16:00", "2027-03-05T17:00"]]) {
    await lead.page.getByRole("button", { name: "New event" }).click();
    await lead.page.getByLabel("Title").fill(t);
    await lead.page.getByLabel("Starts").fill(s);
    await lead.page.getByLabel("Ends").fill(e);
    await lead.page.getByLabel("Description").fill("Bring your updates and open questions.");
    if (t === "Sprint planning") await lead.page.screenshot({ path: `${OUT}/event-dialog-light.png` });
    await lead.page.getByRole("button", { name: "Schedule event" }).click();
    await lead.page.locator("li", { hasText: t }).first().waitFor();
  }
  await lead.page.waitForTimeout(500);
  await lead.page.screenshot({ path: `${OUT}/events-light.png` });
  await lead.page.getByRole("tab", { name: "Calendar" }).click();
  await lead.page.screenshot({ path: `${OUT}/calendar-light.png` });

  await go(lead, "Resources");
  await lead.page.getByRole("button", { name: "Add" }).click();
  await lead.page.getByRole("menuitem", { name: "Add a link" }).click();
  await lead.page.getByRole("textbox", { name: "Name" }).fill("Product roadmap");
  await lead.page.getByRole("textbox", { name: "Link" }).fill("https://example.com/roadmap");
  await lead.page.getByRole("textbox", { name: "Description" }).fill("Q1 priorities and owners");
  await lead.page.getByRole("button", { name: "Add link" }).click();
  await lead.page.getByRole("button", { name: "Add" }).click();
  await lead.page.getByRole("menuitem", { name: "Upload a file" }).click();
  await lead.page.locator("input[type=file]").setInputFiles({ name: "brand-guidelines.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(240_000, 1) });
  await lead.page.getByRole("button", { name: "Upload", exact: true }).click();
  await lead.page.locator("li", { hasText: "brand-guidelines.pdf" }).waitFor({ timeout: 20_000 });
  await lead.page.waitForTimeout(500);
  await lead.page.screenshot({ path: `${OUT}/resources-light.png` });

  await go(lead, "People");
  await lead.page.screenshot({ path: `${OUT}/people-light.png`, fullPage: true });

  await member.page.getByRole("button", { name: /Notifications/ }).click();
  await member.page.waitForTimeout(600);
  await member.page.screenshot({ path: `${OUT}/notifications-member.png` });
  await member.page.keyboard.press("Escape");
  await lead.page.keyboard.press("Control+k");
  await lead.page.getByRole("combobox", { name: "Search" }).fill("sprint");
  await lead.page.waitForTimeout(400);
  await lead.page.screenshot({ path: `${OUT}/search-light.png` });
  await lead.page.keyboard.press("Escape");

  await lead.page.emulateMedia({ colorScheme: "dark" });
  await lead.page.getByRole("button", { name: "Switch to dark theme" }).first().click().catch(() => undefined);
  await go(lead, "Chat");
  await lead.page.waitForTimeout(500);
  await lead.page.screenshot({ path: `${OUT}/chat-dark.png` });
  await go(lead, "Events");
  await lead.page.waitForTimeout(500);
  await lead.page.screenshot({ path: `${OUT}/events-dark.png` });

  // member on a phone
  await member.page.setViewportSize({ width: 390, height: 844 });
  await member.page.waitForTimeout(500);
  await member.page.screenshot({ path: `${OUT}/mobile-chat.png` });
  await member.page.getByRole("navigation", { name: "Primary" }).last().getByRole("button", { name: "Events" }).click();
  await member.page.waitForTimeout(500);
  await member.page.screenshot({ path: `${OUT}/mobile-events.png` });

  // auth + landing
  const anon = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await anon.goto("/");
  await anon.screenshot({ path: `${OUT}/landing.png`, fullPage: true });
  await anon.goto("/signup");
  await anon.screenshot({ path: `${OUT}/signup.png` });
  await anon.goto("/login");
  await anon.screenshot({ path: `${OUT}/login.png` });
  void uniq;
});
