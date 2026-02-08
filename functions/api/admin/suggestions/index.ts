// functions/api/admin/suggestions/index.ts
import { requireAuth, requireRole } from "../_auth";
import type { EnvAuth } from "../_auth";

function nowIso() {
  return new Date().toISOString();
}

function clampInt(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function allowedStatus(input: string): string {
  const s = String(input ?? "").trim();
  return s === "pending" || s === "approved" || s === "rejected" || s === "deleted"
    ? s
    : "pending";
}

async function fetchSuggestion(env: EnvAuth["DB"], id: string) {
  return env
    .prepare(
      `SELECT
         id, title, url, url_norm, description, device_id,
         status, created_at, reviewed_at, reviewed_by_user_id, review_note, approved_item_id
       FROM item_suggestions
       WHERE id = ?
       LIMIT 1`,
    )
    .bind(id)
    .first<any>();
}

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  try {
    await env.DB.exec("PRAGMA foreign_keys = ON;");

    const user = await requireAuth(env, request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!requireRole(user, ["superadmin", "admin", "editor"])) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const method = request.method;
    const url = new URL(request.url);

    /* =========================
       GET /api/admin/suggestions?status=pending&limit=50
       ========================= */
    if (method === "GET") {
      const status = allowedStatus(url.searchParams.get("status") ?? "pending");
      const limitRaw = Number(url.searchParams.get("limit") ?? "50");
      const limit = clampInt(limitRaw, 1, 200);

      const { results } = await env.DB.prepare(
        `SELECT
           id, title, url, url_norm, description, device_id,
           status, created_at, reviewed_at, reviewed_by_user_id, review_note, approved_item_id
         FROM item_suggestions
         WHERE status = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
        .bind(status, limit)
        .all<any>();

      return Response.json({ suggestions: (results ?? []) as any[] });
    }

    /* =========================
       POST /api/admin/suggestions?action=approve&id=...
       POST /api/admin/suggestions?action=reject&id=...
       ========================= */
    if (method === "POST") {
      const action = String(url.searchParams.get("action") ?? "").trim();
      const id = String(url.searchParams.get("id") ?? "").trim();
      if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

      const current = await fetchSuggestion(env.DB, id);
      if (!current) return Response.json({ error: "Not found" }, { status: 404 });

      if (current.status !== "pending") {
        return Response.json(
          { error: "Invalid status", code: "INVALID_STATUS" },
          { status: 409 },
        );
      }

      const reviewedAt = nowIso();

      if (action === "approve") {
        await env.DB.prepare(
          `UPDATE item_suggestions
           SET status = 'approved',
               reviewed_at = ?,
               reviewed_by_user_id = ?
           WHERE id = ?`,
        )
          .bind(reviewedAt, user.id, id)
          .run();

        const updated = await fetchSuggestion(env.DB, id);
        return Response.json({ ok: true, suggestion: updated });
      }

      if (action === "reject") {
        const body = (await request.json().catch(() => null)) as null | { note?: string };
        const note = String(body?.note ?? "").trim();

        await env.DB.prepare(
          `UPDATE item_suggestions
           SET status = 'rejected',
               reviewed_at = ?,
               reviewed_by_user_id = ?,
               review_note = ?
           WHERE id = ?`,
        )
          .bind(reviewedAt, user.id, note || null, id)
          .run();

        return Response.json({ ok: true });
      }

      return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    /* =========================
       DELETE /api/admin/suggestions?id=...
       (soft delete: status='deleted')
       ========================= */
    if (method === "DELETE") {
      if (!requireRole(user, ["superadmin", "admin"])) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }

      const id = String(url.searchParams.get("id") ?? "").trim();
      if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

      const current = await fetchSuggestion(env.DB, id);
      if (!current) return Response.json({ error: "Not found" }, { status: 404 });

      const reviewedAt = nowIso();

      await env.DB.prepare(
        `UPDATE item_suggestions
         SET status = 'deleted',
             reviewed_at = COALESCE(reviewed_at, ?),
             reviewed_by_user_id = COALESCE(reviewed_by_user_id, ?)
         WHERE id = ?`,
      )
        .bind(reviewedAt, user.id, id)
        .run();

      return Response.json({ ok: true });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (e: any) {
    return Response.json(
      { error: "admin suggestions endpoint failed", message: String(e?.message ?? e) },
      { status: 500 },
    );
  }
};
