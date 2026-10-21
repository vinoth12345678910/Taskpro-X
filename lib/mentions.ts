export interface MentionCandidate {
  uid: string;
  name: string;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Find @mentions of known people. A mention is `@` + the person's display name,
 * case-insensitive, ending at a non-word boundary. Longest names are matched first
 * so "@Ann Lee" is not read as "@Ann".
 */
export function extractMentions(text: string, people: MentionCandidate[], selfUid?: string): string[] {
  const found = new Set<string>();
  const sorted = [...people].filter((p) => p.name.trim()).sort((a, b) => b.name.length - a.name.length);
  let remaining = text;
  for (const p of sorted) {
    const re = new RegExp(`(^|[^\\w@])@${escapeRe(p.name.trim())}(?![\\p{L}\\p{N}_])`, "giu");
    if (re.test(remaining)) {
      if (p.uid !== selfUid) found.add(p.uid);
      remaining = remaining.replace(re, "$1");
    }
  }
  return [...found];
}

/** Split text into plain and mention segments for rendering. */
export function segmentMentions(text: string, people: MentionCandidate[]): { text: string; mention: boolean }[] {
  const names = [...people].map((p) => p.name.trim()).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!names.length) return [{ text, mention: false }];
  const re = new RegExp(`(^|[^\\w@])(@(?:${names.map(escapeRe).join("|")}))(?![\\p{L}\\p{N}_])`, "giu");
  const out: { text: string; mention: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const start = (m.index ?? 0) + m[1].length;
    if (start > last) out.push({ text: text.slice(last, start), mention: false });
    out.push({ text: m[2], mention: true });
    last = start + m[2].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), mention: false });
  return out.length ? out : [{ text, mention: false }];
}
