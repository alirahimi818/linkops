// functions/api/admin/validate-hashtags.ts
import { requireAuth, requireRole } from "./_auth";
import type { EnvAuth } from "./_auth";

function extractHashtags(text: string): Array<{ raw: string; tag: string; index: number }> {
  // tag stored without '#'
  const out: Array<{ raw: string; tag: string; index: number }> = [];
  const re = /#[\p{L}\p{N}_]+/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const tag = raw.slice(1).toLowerCase();
    out.push({ raw, tag, index: m.index });
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
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function bestSuggestion(tag: string, whitelist: string[]): { suggestion: string | null; distance: number } {
  let best: string | null = null;
  let bestDist = Infinity;

  for (const w of whitelist) {
    const d = levenshtein(tag, w);
    if (d < bestDist) {
      bestDist = d;
      best = w;
    }
  }

  // threshold: tune later
  if (best == null) return { suggestion: null, distance: bestDist };
  if (bestDist <= 2) return { suggestion: best, distance: bestDist };
  if (tag.length >= 8 && bestDist <= 3) return { suggestion: best, distance: bestDist };
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

  const whitelist = (results ?? []).map((r: any) => String(r.tag).toLowerCase());
  const whitelistSet = new Set(whitelist);

  const report = tags.map((t) => {
    const valid = whitelistSet.has(t.tag);
    if (valid) {
      return {
        raw: t.raw,
        tag: t.tag,
        index: t.index,
        valid: true,
        suggestion: null,
      };
    }

    const { suggestion } = bestSuggestion(t.tag, whitelist);
    return {
      raw: t.raw,
      tag: t.tag,
      index: t.index,
      valid: false,
      suggestion: suggestion ? `#${suggestion}` : null,
    };
  });

  return Response.json({
    ok: true,
    count: report.length,
    report,
  });
};
