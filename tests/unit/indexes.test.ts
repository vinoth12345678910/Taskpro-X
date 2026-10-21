import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The emulator does NOT enforce composite indexes but production Firestore does, so every
 * multi-field query in lib/ must have a matching entry here (this caught a missing chat index).
 */
const indexes = JSON.parse(readFileSync("firestore.indexes.json", "utf8")).indexes as {
  collectionGroup: string;
  fields: { fieldPath: string; order: string }[];
}[];
const has = (col: string, ...fields: [string, string][]) =>
  indexes.some((i) => i.collectionGroup === col && JSON.stringify(i.fields.map((f) => [f.fieldPath, f.order])) === JSON.stringify(fields));

describe("firestore.indexes.json", () => {
  it("covers every composite query the app runs", () => {
    expect(has("chat_messages", ["roomId", "ASCENDING"], ["timestamp", "DESCENDING"])).toBe(true); // lib/chat.ts latest + older pages
    expect(has("events", ["teamId", "ASCENDING"], ["startAt", "ASCENDING"])).toBe(true); // lib/eventsService.ts
    expect(has("notifications", ["recipientId", "ASCENDING"], ["createdAt", "DESCENDING"])).toBe(true); // lib/notifications.ts
    expect(has("resources", ["teamId", "ASCENDING"], ["updatedAt", "DESCENDING"])).toBe(true); // lib/resources.ts
  });
});
