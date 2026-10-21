import { Timestamp } from "firebase/firestore";

/** Firestore Timestamp | Date | null → Date | undefined */
export function toDate(v: unknown): Date | undefined {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return undefined;
}

export function isPermissionDenied(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: string }).code === "permission-denied";
}

export function isUnavailable(err: unknown): boolean {
  const code = err && typeof err === "object" ? (err as { code?: string }).code : undefined;
  return code === "unavailable" || code === "deadline-exceeded";
}

/** A short random id for invite codes. Unambiguous alphabet (no 0/O/1/I). */
export function randomCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Human-readable message for common Firebase errors. */
export function friendlyError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const code = err && typeof err === "object" ? (err as { code?: string }).code : undefined;
  switch (code) {
    case "permission-denied":
      return "You don't have permission to do that.";
    case "unavailable":
    case "deadline-exceeded":
    case "auth/network-request-failed":
      return "You appear to be offline. Check your connection and try again.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-login-credentials":
      return "That email and password don't match.";
    case "auth/email-already-in-use":
      return "An account with that email already exists. Try signing in.";
    case "auth/weak-password":
      return "Choose a password with at least 6 characters.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "resource-exhausted":
      return "Too many requests right now. Please slow down and retry.";
    default:
      return fallback;
  }
}
