export type View = "chat" | "events" | "resources" | "people";
export const VIEWS: View[] = ["chat", "events", "resources", "people"];

export interface NavTarget {
  view: View;
  teamId?: string;
  /** event id or message id to scroll to / open */
  id?: string;
  /** when set with view=chat, open this message's thread */
  threadOf?: string;
}

export function parseHash(hash: string): { view: View; id?: string; threadOf?: string } {
  const [, view, id, extra] = hash.replace(/^#/, "").split("/");
  const v = (VIEWS as string[]).includes(view) ? (view as View) : "chat";
  return { view: v, id: id || undefined, threadOf: extra === "thread" ? id : undefined };
}

export function toHash(t: NavTarget): string {
  const parts = ["", t.view];
  if (t.id) parts.push(t.id);
  if (t.threadOf) parts.push("thread");
  return `#${parts.join("/")}`;
}
