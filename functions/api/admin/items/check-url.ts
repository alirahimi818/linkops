import { requireAuth, requireRole } from "../_auth";
import type { EnvAuth } from "../_auth";

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

  if (
    host === "instagram.com" ||
    host.endsWith(".instagram.com") ||
    host === "instagr.am" ||
    host.endsWith(".instagr.am")
  ) {
    u.search = "";
    return u.toString();
  }

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

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  try {
    const user = await requireAuth(env, request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!requireRole(user, ["superadmin", "admin", "editor"])) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (request.method !== "GET") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const qs = new URL(request.url).searchParams;
    const rawUrl = qs.get("url") ?? "";
    const excludeId = qs.get("exclude_id") ?? null;

    if (!rawUrl) {
      return Response.json({ error: "Missing url" }, { status: 400 });
    }

    const urlNorm = normalizeUrlForDedup(rawUrl);
    if (!urlNorm) {
      return Response.json({ exists: false });
    }

    const row = excludeId
      ? await env.DB.prepare(
          `SELECT id FROM items WHERE url_norm = ? AND id != ? LIMIT 1`,
        )
          .bind(urlNorm, excludeId)
          .first()
      : await env.DB.prepare(
          `SELECT id FROM items WHERE url_norm = ? LIMIT 1`,
        )
          .bind(urlNorm)
          .first();

    if (row) {
      return Response.json({ exists: true, item_id: (row as any).id });
    }

    return Response.json({ exists: false });
  } catch (e: any) {
    return Response.json(
      { error: "check-url failed", message: String(e?.message ?? e) },
      { status: 500 },
    );
  }
};
