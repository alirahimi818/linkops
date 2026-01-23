export type HashtagIssue = {
  raw: string;              // e.g. "#SomeTag"
  normalized: string;       // e.g. "sometag" (lowercase, without #)
  suggestion: string | null; // e.g. "sometag" (without #)
  reason: string;
};

export function normalizeTag(tag: string): string {
  const t = tag.trim();
  const noHash = t.startsWith("#") ? t.slice(1) : t;
  return noHash.toLowerCase();
}

export function extractHashtags(text: string): string[] {
  const re = /#[\p{L}\p{N}_]+/gu;
  return text.match(re) ?? [];
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

function suggest(normalized: string, whitelist: string[]): string | null {
  let best: { t: string; d: number } | null = null;
  for (const t of whitelist) {
    const d = levenshtein(normalized, t.toLowerCase());
    if (!best || d < best.d) best = { t, d };
    if (best.d === 0) break;
  }

  if (!best) return null;
  if (best.d <= 2) return best.t;
  if (normalized.length >= 8 && best.d <= 3) return best.t;
  return null;
}

export function validateHashtags(text: string, whitelistSet: Set<string>): HashtagIssue[] {
  const whitelist = Array.from(whitelistSet.values());
  const tags = extractHashtags(text);
  const issues: HashtagIssue[] = [];

  for (const raw of tags) {
    const normalized = normalizeTag(raw);
    if (!normalized) continue;

    if (!whitelistSet.has(normalized)) {
      const s = suggest(normalized, whitelist);
      issues.push({
        raw,
        normalized,
        suggestion: s,
        reason: s ? "هشگ ناشناخته (منظورتان این بود؟)" : "هشتگ ناشناخته",
      });
    }
  }

  return issues;
}

export function applySuggestedReplacements(text: string, issues: HashtagIssue[]): string {
  let out = text;
  for (const i of issues) {
    if (!i.suggestion) continue;
    const from = `#${i.normalized}`;
    const to = `#${i.suggestion}`;
    out = out.split(from).join(to);
  }
  return out;
}
