// functions/api/admin/validate-hashtags.ts
import { requireAuth, requireRole } from "./_auth";
import type { EnvAuth } from "./_auth";

function norm(s: string): string {
  return String(s ?? "").trim().toLocaleLowerCase();
}

function extractHashtags(text: string): Array<{ raw: string; tagNorm: string; index: number }> {
  const out: Array<{ raw: string; tagNorm: string; index: number }> = [];
  const re = /#[\p{L}\p{N}_]+/gu;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const raw = m[0]; // e.g. "#IranRevolution2026"
    const tagNorm = norm(raw.slice(1)); // normalize for matching only
    out.push({ raw, tagNorm, index: m.index });
  }

  return out;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[m][n];
}

function bestSuggestion(
  tagNorm: string,
  whitelistNormKeys: string[],
  whitelistMap: Map<string, string> // norm -> original(DB)
): { suggestion: string | null; distance: number } {
  let bestKey: string | null = null;
  let bestDist = Infinity;

  for (const k of whitelistNormKeys) {
    const d = levenshtein(tagNorm, k);
    if (d < bestDist) {
      bestDist = d;
      bestKey = k;
      if (bestDist === 0) break;
    }
  }

  if (bestKey == null) return { suggestion: null, distance: bestDist };

  const original = whitelistMap.get(bestKey) ?? null; // keep camelCase / فارسی
  if (!original) return { suggestion: null, distance: bestDist };

  // threshold: tune later
  if (bestDist <= 2) return { suggestion: original, distance: bestDist };
  if (tagNorm.length >= 8 && bestDist <= 3) return { suggestion: original, distance: bestDist };

  return { suggestion: null, distance: bestDist };
}

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  const user = await requireAuth(env, request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!requireRole(user, ["superadmin", "admin", "editor"])) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = (await request.json().catch(() => null)) as null | { text: string };
  if (!body?.text || typeof body.text !== "string") {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const text = body.text;
  const tags = extractHashtags(text);

  const { results } = await env.DB.prepare(
    `SELECT tag, priority, active
     FROM hashtag_whitelist
     WHERE active = 1`
  ).all<any>();

  // Build case-insensitive map: normalized -> original(tag in DB)
  const whitelistMap = new Map<string, string>();
  for (const r of results ?? []) {
    const original = String(r.tag ?? "").trim();
    if (!original) continue;

    const k = norm(original);
    if (!whitelistMap.has(k)) whitelistMap.set(k, original);
  }

  const whitelistNormKeys = Array.from(whitelistMap.keys());
  const whitelistSet = new Set(whitelistNormKeys);

  const report = tags.map((t) => {
    const valid = whitelistSet.has(t.tagNorm);

    if (valid) {
      // Return original (DB) when it exists
      const original = whitelistMap.get(t.tagNorm) ?? null;

      return {
        raw: t.raw,
        tag: t.tagNorm, // for debug/internal only
        index: t.index,
        valid: true,
        suggestion: null,
        canonical: original ? `#${original}` : null, // optional but helpful
      };
    }

    const { suggestion } = bestSuggestion(t.tagNorm, whitelistNormKeys, whitelistMap);

    return {
      raw: t.raw,
      tag: t.tagNorm, // normalized form
      index: t.index,
      valid: false,
      suggestion: suggestion ? `#${suggestion}` : null, // IMPORTANT: DB-cased
    };
  });

  return Response.json({
    ok: true,
    count: report.length,
    report,
  });
};