// functions/api/suggestions.ts

import { rateLimitByDevice, rateLimitResponse } from "./_rate_limit";

type Env = { DB: D1Database };

function nowIso() {
  return new Date().toISOString();
}

function getDeviceId(request: Request): string {
  const v = request.headers.get("X-Device-Id");
  return String(v ?? "").trim();
}

function isValidAbsoluteHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Similar to your admin normalizeUrlForDedup (keep consistent)
function normalizeUrlForDedup(input: string): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "";

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }

  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");

  const host = u.hostname;

  // X / Twitter status canonical
  if (
    host === "x.com" ||
    host === "twitter.com" ||
    host.endsWith(".x.com") ||
    host.endsWith(".twitter.com")
  ) {
    const m = u.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
    if (m) {
      u.pathname = `/${m[1]}/status/${m[2]}`;
      u.search = "";
      return u.toString();
    }
  }

  // Instagram: drop all query params
  if (
    host === "instagram.com" ||
    host.endsWith(".instagram.com") ||
    host === "instagr.am" ||
    host.endsWith(".instagr.am")
  ) {
    u.search = "";
    return u.toString();
  }

  // Default: drop common tracking params
  const tracking = new Set([
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
  ]);
  for (const k of [...u.searchParams.keys()]) {
    if (tracking.has(k.toLowerCase())) u.searchParams.delete(k);
  }
  return u.toString();
}

// Optional: auto-fix url (prefix https:// if missing)
function autoFixUrl(input: string): string {
  const s = String(input ?? "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  // simple heuristic
  return `https://${s}`;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await env.DB.exec("PRAGMA foreign_keys = ON;");

    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const deviceId = getDeviceId(request);
    if (!deviceId) {
      return Response.json(
        { error: "Missing X-Device-Id header" },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => null)) as null | {
      url?: string;
      title?: string;
      description?: string;
    };

    const urlRaw = autoFixUrl(String(body?.url ?? ""));
    const title = String(body?.title ?? "").trim();
    const description = String(body?.description ?? "").trim();

    if (!urlRaw) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (!isValidAbsoluteHttpUrl(urlRaw)) {
      return Response.json(
        { error: "Invalid url", code: "INVALID_URL" },
        { status: 400 },
      );
    }

    const urlNorm = normalizeUrlForDedup(urlRaw);
    if (!urlNorm) {
      return Response.json(
        { error: "Invalid url", code: "INVALID_URL" },
        { status: 400 },
      );
    }

    // 1) If already exists in items anywhere:
    // (We only have url_norm unique per date or global in items, but for suggestions we block if it exists at all.)
    const existingItem = await env.DB.prepare(
      `SELECT id FROM items WHERE url_norm = ? LIMIT 1`,
    )
      .bind(urlNorm)
      .first<any>();

    if (existingItem) {
      return Response.json(
        { error: "Duplicate URL", code: "DUPLICATE_URL" },
        { status: 409 },
      );
    }

    // 2) If pending suggestion exists:
    const pending = await env.DB.prepare(
      `SELECT id FROM item_suggestions WHERE url_norm = ? AND status = 'pending' LIMIT 1`,
    )
      .bind(urlNorm)
      .first<any>();

    if (pending) {
      return Response.json(
        { error: "Duplicate suggestion", code: "DUPLICATE_SUGGESTION" },
        { status: 409 },
      );
    }

    // Rate limit: allow only 1 successful suggestion per minute per device
    const rl = await rateLimitByDevice({
      db: env.DB,
      deviceId,
      action: "suggestions_create",
      rule: { windowSec: 60, limit: 1 }
    });

    if (!rl.ok) return rateLimitResponse(rl.retry_after);

    const id = crypto.randomUUID();
    const createdAt = nowIso();

    await env.DB.prepare(
      `INSERT INTO item_suggestions
        (id, title, url, url_norm, description, device_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    )
      .bind(
        id,
        title || null,
        urlRaw,
        urlNorm,
        description || null,
        deviceId,
        createdAt,
      )
      .run();

    return Response.json({ ok: true, id });
  } catch (e: any) {
    return Response.json(
      {
        error: "suggestions endpoint failed",
        message: String(e?.message ?? e),
      },
      { status: 500 },
    );
  }
};
