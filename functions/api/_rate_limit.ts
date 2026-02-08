// functions/api/_rate_limit.ts

type RateLimitAction =
  | "items_get"
  | "items_feed"
  | "status_set"
  | "suggestions_create"
  | "ai_call";

type RateLimitRule = {
  windowSec: number; // e.g. 60
  limit: number;     // e.g. 120
};

const RULES: Record<RateLimitAction, RateLimitRule> = {
  items_get: { windowSec: 60, limit: 120 },
  items_feed: { windowSec: 60, limit: 60 },
  status_set: { windowSec: 60, limit: 60 },
  suggestions_create: { windowSec: 60, limit: 5 },
  ai_call: { windowSec: 60, limit: 10 }, // later: tighten for AI if needed
};

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function windowStart(now: number, windowSec: number) {
  return now - (now % windowSec);
}

function buildKey(deviceId: string, action: RateLimitAction) {
  return `dev:${deviceId}:${action}`;
}

async function maybeCleanup(params: {
  db: D1Database;
  ttlSec: number;        // e.g. 7 days
  chance: number;        // e.g. 0.02 = 2%
}) {
  // Keep it cheap: do cleanup only sometimes
  if (Math.random() > params.chance) return;

  const cutoff = nowSec() - params.ttlSec;
  await params.db
    .prepare(`DELETE FROM rate_limits WHERE updated_at < ?`)
    .bind(cutoff)
    .run();
}

export async function rateLimitByDevice(params: {
  db: D1Database;
  deviceId: string;
  action: RateLimitAction;

  // Optional overrides
  rule?: Partial<RateLimitRule>;

  // Cleanup policy
  ttlSec?: number;    // default 7 days
  cleanupChance?: number; // default 2%
}): Promise<
  | { ok: true; remaining: number }
  | { ok: false; retry_after: number }
> {
  const base = RULES[params.action];
  const rule: RateLimitRule = {
    windowSec: params.rule?.windowSec ?? base.windowSec,
    limit: params.rule?.limit ?? base.limit,
  };

  const now = nowSec();
  const wStart = windowStart(now, rule.windowSec);
  const key = buildKey(params.deviceId, params.action);

  // UPSERT in one statement:
  // - if same window_start: count += 1
  // - else: reset to count = 1 and update window_start
  await params.db
    .prepare(
      `
      INSERT INTO rate_limits (key, window_start, count, updated_at)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET
        window_start = CASE
          WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.window_start
          ELSE excluded.window_start
        END,
        count = CASE
          WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1
          ELSE 1
        END,
        updated_at = excluded.updated_at
      `,
    )
    .bind(key, wStart, now)
    .run();

  const row = await params.db
    .prepare(`SELECT window_start, count FROM rate_limits WHERE key = ? LIMIT 1`)
    .bind(key)
    .first<any>();

  const count = Number(row?.count ?? 1);
  const rowStart = Number(row?.window_start ?? wStart);

  if (rowStart !== wStart) {
    // Very rare race / timing edge; be permissive
    return { ok: true, remaining: Math.max(0, rule.limit - 1) };
  }

  if (count > rule.limit) {
    const retryAfter = Math.max(1, rowStart + rule.windowSec - now);
    // Cleanup (cheap)
    await maybeCleanup({
      db: params.db,
      ttlSec: params.ttlSec ?? 7 * 24 * 3600,
      chance: params.cleanupChance ?? 0.02,
    });
    return { ok: false, retry_after: retryAfter };
  }

  // Cleanup (cheap)
  await maybeCleanup({
    db: params.db,
    ttlSec: params.ttlSec ?? 7 * 24 * 3600,
    chance: params.cleanupChance ?? 0.02,
  });

  return { ok: true, remaining: Math.max(0, rule.limit - count) };
}

export function rateLimitResponse(retryAfter: number) {
  return Response.json(
    { error: "Too many requests", code: "RATE_LIMITED", retry_after: retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
