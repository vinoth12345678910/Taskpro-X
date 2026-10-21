import { expect, test } from "@playwright/test";
import { go, newPerson, signUp, createTeam, joinTeam, send, team, uniq } from "./helpers";

test.describe("notification center", () => {
  test("mentions and event changes are persisted per recipient and can be marked read", async ({ browser }) => {
    const { lead, member, teamName } = await team(browser);

    // member mentions the lead
    const text = `${uniq("ping")} @Lena Lead please look`;
    await send(member, teamName, text);
    const bell = lead.page.getByRole("button", { name: /Notifications/ });
    await expect(bell).toHaveAccessibleName(/1 unread/, { timeout: 20_000 });
    // the author does not notify themselves
    await expect(member.page.getByRole("button", { name: /^Notifications$/ })).toBeVisible();

    // lead schedules an event → member is notified
    await go(lead, "Events");
    await lead.page.getByRole("button", { name: "New event" }).click();
    const title = uniq("Standup");
    await lead.page.getByLabel("Title").fill(title);
    await lead.page.getByLabel("Starts").fill("2027-03-03T09:00");
    await lead.page.getByLabel("Ends").fill("2027-03-03T09:30");
    await lead.page.getByRole("button", { name: "Schedule event" }).click();
    await expect(member.page.getByRole("button", { name: /Notifications, 1 unread/ }), `member bell: ${await member.page.getByRole("button", { name: /Notifications/ }).getAttribute("aria-label")}`).toBeVisible({ timeout: 20_000 });

    // persisted: still unread after reload
    await member.page.reload();
    await expect(member.page.getByRole("button", { name: /Notifications, 1 unread/ })).toBeVisible({ timeout: 20_000 });

    // open → navigates to the event and marks it read
    await member.page.getByRole("button", { name: /Notifications/ }).click();
    await member.page.getByRole("region", { name: "Notifications" }).getByText(`New event: ${title}`).click();
    await expect(member.page.locator("li", { hasText: title })).toBeVisible();
    await expect(member.page.getByRole("button", { name: /^Notifications$/ })).toBeVisible({ timeout: 20_000 });

    // lead: mark all as read
    await lead.page.getByRole("button", { name: /Notifications/ }).click();
    await lead.page.getByRole("button", { name: "Mark all read" }).click();
    await expect(lead.page.getByRole("button", { name: /^Notifications$/ })).toBeVisible({ timeout: 20_000 });
    await lead.page.reload();
    await expect(lead.page.getByRole("button", { name: /^Notifications$/ })).toBeVisible();
  });

  test("a notification preference turns delivery off", async ({ browser }) => {
    const { lead, member, teamName } = await team(browser);
    await go(member, "People");
    await member.page.getByRole("switch", { name: "Mentions" }).click();
    await expect(member.page.getByRole("switch", { name: "Mentions" })).toHaveAttribute("aria-checked", "false");
    // lead's roster has updated prefs
    // Preferences are read from the sender's live roster; give the change a moment to reach the lead's client.
    await lead.page.waitForTimeout(2000);
    await send(lead, teamName, `${uniq("hey")} @Milo Member`);
    await go(lead, "Events"); // let delivery settle
    await member.page.waitForTimeout(2500);
    await expect(member.page.getByRole("button", { name: /^Notifications$/ })).toBeVisible();
  });
});

test.describe("shared resources", () => {
  test("members share links and files; other teams cannot see them", async ({ browser }) => {
    const { lead, member } = await team(browser);

    await go(member, "Resources");
    await expect(member.page.getByText("Nothing shared yet")).toBeVisible();
    await member.page.getByRole("button", { name: "Add" }).click();
    await member.page.getByRole("menuitem", { name: "Add a link" }).click();
    const name = uniq("Spec");
    await member.page.getByRole("textbox", { name: "Name" }).fill(name);
    await member.page.getByRole("textbox", { name: "Link" }).fill("javascript:alert(1)");
    await member.page.getByRole("button", { name: "Add link" }).click();
    await expect(member.page.getByText(/valid link|http/i).first()).toBeVisible();
    await member.page.getByRole("textbox", { name: "Link" }).fill("https://example.com/spec");
    await member.page.getByRole("button", { name: "Add link" }).click();

    await go(lead, "Resources");
    await expect(lead.page.getByText(name)).toBeVisible({ timeout: 20_000 });

    // file upload through Firebase Storage (emulator) with progress and size/type metadata from storage
    await member.page.getByRole("button", { name: "Add" }).click();
    await member.page.getByRole("menuitem", { name: "Upload a file" }).click();
    await member.page.locator("input[type=file]").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello shared world") });
    await member.page.getByRole("button", { name: "Upload", exact: true }).click();
    await expect(lead.page.getByText("notes.txt")).toBeVisible({ timeout: 30_000 });
    await expect(lead.page.getByText(/18 B/)).toBeVisible();

    // unsupported type is refused client-side
    await member.page.getByRole("button", { name: "Add" }).click();
    await member.page.getByRole("menuitem", { name: "Upload a file" }).click();
    await member.page.locator("input[type=file]").setInputFiles({ name: "x.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
    await expect(member.page.locator("p[role=alert]")).toContainText(/isn't supported/);
    await member.page.keyboard.press("Escape");

    // filtering
    await member.page.getByLabel("Search resources").fill("notes");
    await expect(member.page.getByText(name)).toHaveCount(0);
    await expect(member.page.locator("li", { hasText: "notes.txt" })).toBeVisible();

    // a different team sees nothing
    const other = await newPerson(browser, "Olive Other");
    await signUp(other, "team_lead");
    const otherCode = await createTeam(other, uniq("Elsewhere"));
    expect(otherCode).toBeTruthy();
    await go(other, "Resources");
    await expect(other.page.getByText("Nothing shared yet")).toBeVisible();

    // the owner (member) can delete; the delete is visible to the lead
    await member.page.getByLabel("Search resources").fill("");
    await member.page.getByRole("button", { name: `Delete ${name}` }).click();
    await member.page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(lead.page.getByText(name)).toHaveCount(0, { timeout: 20_000 });
    void joinTeam;
  });
});
