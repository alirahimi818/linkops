// functions/api/admin/item-comments.ts
import { requireAuth, requireRole } from "./_auth";
import type { EnvAuth } from "./_auth";

function nowIso() {
  return new Date().toISOString();
}

function clampInt(v: any, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normText(v: any, maxLen: number) {
  return String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, maxLen);
}

type IncomingComment = {
  text: string;
  translation_text?: string | null;
};

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  try {
    const user = await requireAuth(env, request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Allow admin/editor/superadmin
    if (!requireRole(user, ["superadmin", "admin", "editor"])) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (request.method === "GET") {
      const { results } = await env.DB.prepare(
        `SELECT id, tag, priority, is_active, created_at
         FROM hashtag_whitelist
         ORDER BY is_active DESC, priority DESC, tag ASC`
      ).all();

      return Response.json({ hashtags: results ?? [] });
    }

    const url = new URL(request.url);

    // You can choose to support GET later; for now, we focus on POST bulk save.
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const itemId = url.searchParams.get("item_id");
    if (!itemId) {
      return Response.json({ error: "Missing item_id" }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as
      | null
      | {
          comments?: IncomingComment[];
          author_type?: "ai" | "admin";
          limit?: number;
        };

    const commentsRaw = Array.isArray(body?.comments) ? body?.comments : null;
    if (!commentsRaw || commentsRaw.length === 0) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    const limit = clampInt(body?.limit, 1, 50, 50);
    const maxTextLen = 1000;

    const author_type: "ai" | "admin" =
      body?.author_type === "admin" ? "admin" : "ai";

    const createdAt = nowIso();
    const saved_comment_ids: string[] = [];

    const itemExists = await env.DB.prepare(
      `SELECT id FROM items WHERE id = ? LIMIT 1`,
    )
      .bind(itemId)
      .first();

    if (!itemExists) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    // Insert one by one (D1 style). If you later want perf, wrap in batch.
    const list = commentsRaw.slice(0, limit);

    for (const c of list) {
      const text = normText(c?.text, maxTextLen);
      if (!text) continue;

      const tr =
        c?.translation_text == null
          ? null
          : normText(c.translation_text, maxTextLen) || null;

      const id = crypto.randomUUID();
      saved_comment_ids.push(id);

      await env.DB.prepare(
        `INSERT INTO item_comments (id, item_id, text, translation_text, author_type, author_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          itemId,
          text,
          tr,
          author_type,
          user?.id ?? null,
          createdAt,
        )
        .run();
    }

    return Response.json({ ok: true, saved_comment_ids });
  } catch (e: any) {
    return Response.json(
      {
        error: "item-comments endpoint failed",
        message: String(e?.message ?? e),
      },
      { status: 500 },
    );
  }
};