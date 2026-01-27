// /frontend/src/lib/hashtags.ts

export type HashtagIssue = {
  raw: string;               // e.g. "#SomeTag" (as it appears in user text)
  normalized: string;        // e.g. "sometag" (lowercased, without #) - internal only
  suggestion: string | null; // e.g. "SomeTag" or "iranRevolution2026" (AS STORED IN DB, without #)
  reason: string;
};

export function normalizeTag(tag: string): string {
  const t = String(tag ?? "").trim();
  const noHash = t.startsWith("#") ? t.slice(1) : t;
  // Locale-aware lowercase to behave well for non-English scripts too
  return noHash.toLocaleLowerCase();
}

export function extractHashtags(text: string): string[] {
  // Letters + numbers + underscore, Unicode-aware (Persian works)
  const re = /#[\p{L}\p{N}_]+/gu;
  return String(text ?? "").match(re) ?? [];
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a lookup that is case-insensitive for matching,
 * but returns the ORIGINAL tag as stored in DB (camelCase, فارسی, ...)
 *
 * Input whitelistSet is expected to contain ORIGINAL tags (without '#')
 */
function buildWhitelistMap(whitelistSet: Set<string>): {
  map: Map<string, string>; // normalized -> original
  normalizedKeys: string[]; // normalized keys for suggestion search
} {
  const map = new Map<string, string>();

  for (const raw of Array.from(whitelistSet.values())) {
    const original = String(raw ?? "").trim();
    if (!original) continue;

    const key = original.toLocaleLowerCase();

    // If duplicates exist differing only by case, prefer the one already stored first
    if (!map.has(key)) map.set(key, original);
  }

  return { map, normalizedKeys: Array.from(map.keys()) };
}

function suggestNormalized(
  normalized: string,
  whitelistMap: Map<string, string>,
  normalizedKeys: string[]
): string | null {
  let best: { key: string; d: number } | null = null;

  for (const k of normalizedKeys) {
    const d = levenshtein(normalized, k);
    if (!best || d < best.d) best = { key: k, d };
    if (best.d === 0) break;
  }

  if (!best) return null;

  // Return ORIGINAL (as stored in DB)
  const original = whitelistMap.get(best.key) ?? null;
  if (!original) return null;

  if (best.d <= 2) return original;
  if (normalized.length >= 8 && best.d <= 3) return original;

  return null;
}

/**
 * Validate hashtags in text:
 * - Matching is case-insensitive (normalized).
 * - Suggestion is returned EXACTLY as in DB (camelCase / فارسی) without '#'.
 */
export function validateHashtags(text: string, whitelistSet: Set<string>): HashtagIssue[] {
  const { map: whitelistMap, normalizedKeys } = buildWhitelistMap(whitelistSet);

  const tags = extractHashtags(text);
  const issues: HashtagIssue[] = [];

  for (const raw of tags) {
    const normalized = normalizeTag(raw);
    if (!normalized) continue;

    const exists = whitelistMap.has(normalized);
    if (!exists) {
      const s = suggestNormalized(normalized, whitelistMap, normalizedKeys);
      issues.push({
        raw,
        normalized,
        suggestion: s, // ORIGINAL CASE (DB)
        reason: s ? "هشتگ ناشناخته (آیا منظورت این بود؟)" : "هشتگ ناشناخته",
      });
    }
  }

  return issues;
}

/**
 * Apply suggested replacements:
 * - Replace the EXACT raw hashtag occurrences (as typed by user) with DB-cased suggestion.
 * - Uses a Unicode-aware boundary to avoid partial replacements.
 */
export function applySuggestedReplacements(text: string, issues: HashtagIssue[]): string {
  let out = String(text ?? "");

  for (const i of issues) {
    if (!i.suggestion) continue;

    const from = String(i.raw ?? "").trim();
    if (!from) continue;

    // Ensure we replace the exact raw token the user wrote
    const re = new RegExp(`${escapeRegExp(from)}(?![\\p{L}\\p{N}_])`, "gu");
    out = out.replace(re, `#${i.suggestion}`);
  }

  return out;
}