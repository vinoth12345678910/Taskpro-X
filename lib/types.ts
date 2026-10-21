export type Role = "member" | "team_lead" | "admin";
export type UserType = "TEAM_LEAD" | "MEMBER";

export interface NotificationPrefs {
  mentions: boolean;
  replies: boolean;
  events: boolean;
  joins: boolean;
}
export const DEFAULT_PREFS: NotificationPrefs = { mentions: true, replies: true, events: true, joins: true };

export interface Profile {
  uid: string;
  name: string;
  email: string;
  role: Role;
}

export interface Membership {
  id: string;
  uid: string;
  name: string;
  email: string;
  userType: UserType;
  /** The team id is the lead's uid. */
  teamLeadId: string;
  teamLeadName?: string;
  teamName: string;
  joinedAt?: Date;
  prefs?: Partial<NotificationPrefs>;
}

export interface Author {
  uid: string;
  name: string;
  email: string;
  userType: UserType;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  text: string;
  timestamp: Date | null; // null while the server timestamp is pending
  author: Author;
  replyCount: number;
  lastReplyAt?: Date;
  editedAt?: Date;
  deleted: boolean;
  reactions: Record<string, string[]>; // uid -> reaction codes
  mentions: string[];
  pending: boolean;
  parentId?: string;
}

export const REACTIONS = [
  { code: "up", glyph: "👍", label: "Thumbs up" },
  { code: "heart", glyph: "❤️", label: "Heart" },
  { code: "laugh", glyph: "😄", label: "Laugh" },
  { code: "party", glyph: "🎉", label: "Celebrate" },
  { code: "eyes", glyph: "👀", label: "Looking" },
  { code: "check", glyph: "✅", label: "Done" },
] as const;
export type ReactionCode = (typeof REACTIONS)[number]["code"];

export type NotificationType =
  | "mention"
  | "reply"
  | "member_joined"
  | "event_created"
  | "event_updated"
  | "event_cancelled";

export interface AppNotification {
  id: string;
  recipientId: string;
  teamId: string;
  type: NotificationType;
  actor: { uid: string; name: string };
  title: string;
  body: string;
  target: { kind: "message" | "event" | "team"; id: string; parentId?: string };
  groupKey: string;
  read: boolean;
  createdAt: Date | null;
}

export interface TeamEvent {
  id: string;
  teamId: string;
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  timeZone: string;
  status: "scheduled" | "cancelled";
  createdBy: string;
  createdByName: string;
  updatedAt?: Date;
}

export interface TeamResource {
  id: string;
  teamId: string;
  kind: "file" | "link";
  name: string;
  description: string;
  url?: string;
  storagePath?: string;
  size?: number;
  contentType?: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Presence {
  uid: string;
  lastSeen?: Date;
  status: "online" | "away";
}
