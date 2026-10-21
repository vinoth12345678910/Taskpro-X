import { expect, test } from "@playwright/test";
import { go, team, uniq } from "./helpers";

/**
 * Regression coverage for the original bug: events lived only in React state, so they vanished on refresh
 * and no one else ever saw them. These tests drive the full lifecycle through two real clients.
 */
test.describe("event scheduling lifecycle", () => {
  test("create → visible to member in their own time zone → survives reload → edit → cancel", async ({ browser }) => {
    // Lead in Kolkata (UTC+5:30), member in New York (EST in January).
    const { lead, member } = await team(browser, { leadTz: "Asia/Kolkata", memberTz: "America/New_York" });
    const title = uniq("Planning");

    await go(lead, "Events");
    await lead.page.getByRole("button", { name: "New event" }).click();
    await lead.page.getByLabel("Title").fill(title);
    await lead.page.getByLabel("Starts").fill("2027-01-12T09:30");
    await lead.page.getByLabel("Ends").fill("2027-01-12T10:30");
    await lead.page.getByLabel("Description").fill("Agenda: roadmap");
    await lead.page.getByRole("button", { name: "Schedule event" }).click();

    // lead sees it at the time they typed
    const leadCard = lead.page.locator("li", { hasText: title });
    await expect(leadCard).toBeVisible();
    await expect(leadCard).toContainText("9:30 AM");

    // member (no reload) sees the same instant in New York: 09:30 IST = 04:00 UTC = 11:00 PM EST on 11 Jan
    await go(member, "Events");
    const memberCard = member.page.locator("li", { hasText: title });
    await expect(memberCard).toBeVisible({ timeout: 20_000 });
    await expect(memberCard).toContainText("11:00 PM");
    await expect(memberCard).toContainText("9:30 AM"); // "where it was scheduled" note
    await expect(member.page.getByRole("heading", { name: /Monday, January 11/ })).toBeVisible();

    // persistence across reload for both users
    await lead.page.reload();
    await go(lead, "Events");
    await expect(lead.page.locator("li", { hasText: title })).toContainText("9:30 AM");
    await member.page.reload();
    await go(member, "Events");
    await expect(member.page.locator("li", { hasText: title })).toContainText("11:00 PM");

    // members cannot manage events
    await expect(member.page.getByRole("button", { name: `Edit ${title}` })).toHaveCount(0);
    await expect(member.page.getByRole("button", { name: `Cancel ${title}` })).toHaveCount(0);
    await expect(member.page.getByRole("button", { name: "New event" })).toHaveCount(0);

    // edit → both see the new time
    await lead.page.getByRole("button", { name: `Edit ${title}` }).click();
    await lead.page.getByLabel("Starts").fill("2027-01-12T11:00");
    await lead.page.getByRole("button", { name: "Save changes" }).click();
    await expect(lead.page.locator("li", { hasText: title })).toContainText("11:00 AM");
    await expect(member.page.locator("li", { hasText: title })).toContainText("12:30 AM", { timeout: 20_000 }); // 11:00 IST = 05:30Z = 12:30 AM EST

    // cancel → stays listed as cancelled for everyone
    await lead.page.getByRole("button", { name: `Cancel ${title}` }).click();
    await lead.page.getByRole("button", { name: "Cancel event" }).click();
    await expect(member.page.locator("li", { hasText: title })).toContainText("Cancelled", { timeout: 20_000 });
    await expect(lead.page.getByRole("button", { name: `Edit ${title}` })).toHaveCount(0);
  });

  test("validation: end must be after start; DST-skipped times are rejected; nothing is saved on error", async ({ browser }) => {
    const { lead } = await team(browser, { leadTz: "America/New_York" });
    await go(lead, "Events");
    await lead.page.getByRole("button", { name: "New event" }).click();
    await lead.page.getByLabel("Title").fill("Invalid");
    await lead.page.getByLabel("Starts").fill("2027-01-12T10:00");
    await lead.page.getByLabel("Ends").fill("2027-01-12T09:00");
    await lead.page.getByRole("button", { name: "Schedule event" }).click();
    await expect(lead.page.getByText("The end must be after the start.")).toBeVisible();

    // 2027-03-14 02:30 does not exist in New York (spring forward)
    await lead.page.getByLabel("Starts").fill("2027-03-14T02:30");
    await lead.page.getByLabel("Ends").fill("2027-03-14T04:00");
    await lead.page.getByRole("button", { name: "Schedule event" }).click();
    await expect(lead.page.getByText(/does not exist in this time zone/)).toBeVisible();
    await lead.page.keyboard.press("Escape");
    await expect(lead.page.getByText("Nothing scheduled")).toBeVisible();
  });

  test("a double-click on Schedule creates exactly one event", async ({ browser }) => {
    const { lead } = await team(browser);
    const title = uniq("Once");
    await go(lead, "Events");
    await lead.page.getByRole("button", { name: "New event" }).click();
    await lead.page.getByLabel("Title").fill(title);
    await lead.page.getByLabel("Starts").fill("2027-02-02T10:00");
    await lead.page.getByLabel("Ends").fill("2027-02-02T11:00");
    await lead.page.getByRole("button", { name: "Schedule event" }).dblclick();
    await expect(lead.page.locator("li", { hasText: title })).toHaveCount(1);
    await lead.page.reload();
    await go(lead, "Events");
    await expect(lead.page.locator("li", { hasText: title })).toHaveCount(1);
  });

  test("the calendar view shows the event on its day and search finds it", async ({ browser }) => {
    const { lead } = await team(browser);
    const title = uniq("CalEvent");
    await go(lead, "Events");
    await lead.page.getByRole("button", { name: "New event" }).click();
    await lead.page.getByLabel("Title").fill(title);
    await lead.page.getByLabel("Starts").fill("2027-02-02T10:00");
    await lead.page.getByLabel("Ends").fill("2027-02-02T11:00");
    await lead.page.getByRole("button", { name: "Schedule event" }).click();
    await expect(lead.page.locator("li", { hasText: title })).toBeVisible();

    await lead.page.getByRole("tab", { name: "Calendar" }).click();
    for (let i = 0; i < 24; i++) {
      if (await lead.page.getByRole("button", { name: /February 2, 2027, 1 event/ }).count()) break;
      await lead.page.getByRole("button", { name: "Next month" }).click();
    }
    await lead.page.getByRole("button", { name: /February 2, 2027, 1 event/ }).click();
    await expect(lead.page.getByText(title)).toBeVisible();

    await lead.page.keyboard.press("Control+k");
    await lead.page.getByRole("combobox", { name: "Search" }).fill(title.slice(0, 8));
    await expect(lead.page.getByRole("option", { name: new RegExp(title) })).toBeVisible();
  });
});
