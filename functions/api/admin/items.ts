import { requireAuth, requireRole } from "./_auth";
import type { EnvAuth } from "./_auth";

function nowIso() {
  return new Date().toISOString();
}

function isValidDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function normalizeIdList(input: unknown, maxItems: number): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const v of input) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (!s) continue;
    out.push(s);
    if (out.length >= maxItems) break;
  }
  return Array.from(new Set(out));
}

type CommentInput = { text: string; translation_text?: string | null };

function normalizeComments(
  input: unknown,
  maxLen: number,
  maxItems: number,
): CommentInput[] {
  if (!Array.isArray(input)) return [];

  const out: CommentInput[] = [];

  for (const v of input) {
    // Legacy: string[]
    if (typeof v === "string") {
      const text = v.trim();
      if (!text) continue;
      if (text.length > maxLen) continue;

      out.push({ text, translation_text: null });
      if (out.length >= maxItems) break;
      continue;
    }

    // New: {text, translation_text}
    if (v && typeof v === "object") {
      const textRaw = (v as any).text;
      const trRaw = (v as any).translation_text;

      if (typeof textRaw !== "string") continue;

      const text = textRaw.trim();
      if (!text) continue;
      if (text.length > maxLen) continue;

      let translation_text: string | null = null;
      if (typeof trRaw === "string") {
        const t = trRaw.trim();
        translation_text = t ? t.slice(0, maxLen) : null;
      }

      out.push({ text, translation_text });
      if (out.length >= maxItems) break;
      continue;
    }
  }

  return out;
}

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

  // X / Twitter status canonical
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

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  try {
    await env.DB.exec("PRAGMA foreign_keys = ON;");

    const user = await requireAuth(env, request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!requireRole(user, ["superadmin", "admin", "editor"])) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const method = request.method;

    /* =========================
       GET /api/admin/items?date=YYYY-MM-DD
       ========================= */
    if (method === "GET") {
      const url = new URL(request.url);
      const date = url.searchParams.get("date");
      if (!date || !isValidDate(date)) {
        return Response.json(
          { error: "Invalid date. Use YYYY-MM-DD" },
          { status: 400 },
        );
      }

      const { results } = await env.DB.prepare(
        `SELECT i.*,
                u.username AS created_by_username,
                u.email    AS created_by_email,
                u.role     AS created_by_role,
                c.name     AS category_name,
                c.image    AS category_image
         FROM items i
         LEFT JOIN users u ON u.id = i.created_by_user_id
         LEFT JOIN categories c ON c.id = i.category_id
         WHERE (i.date = ? OR i.is_global = 1)
         ORDER BY i.is_global DESC, i.created_at DESC`,
      )
        .bind(date)
        .all();

      const items: any[] = (results as any[]) ?? [];
      const itemIds = items.map((x: any) => x.id);

      if (itemIds.length === 0) return Response.json({ items: [] });

      const placeholders = itemIds.map(() => "?").join(",");

      const { results: actionRows } = await env.DB.prepare(
        `SELECT ia.item_id,
                a.id    AS id,
                a.name  AS name,
                a.label AS label
         FROM item_actions ia
         JOIN actions a ON a.id = ia.action_id
         WHERE ia.item_id IN (${placeholders})
         ORDER BY ia.item_id ASC, a.label ASC`,
      )
        .bind(...itemIds)
        .all();

      const { results: commentsRows } = await env.DB.prepare(
        `SELECT item_id,
                id,
                text,
                translation_text,
                author_type,
                author_id,
                created_at
         FROM item_comments
         WHERE item_id IN (${placeholders})
         ORDER BY item_id, created_at ASC`,
      )
        .bind(...itemIds)
        .all();

      const actionsMap = new Map<
        string,
        Array<{ id: string; name: string; label: string }>
      >();
      for (const r of (actionRows as any[]) ?? []) {
        const arr = actionsMap.get(r.item_id) ?? [];
        arr.push({ id: r.id, name: r.name, label: r.label });
        actionsMap.set(r.item_id, arr);
      }

      const commentsMap = new Map<
        string,
        Array<{
          id: string;
          text: string;
          translation_text: string | null;
          author_type: string | null;
          author_id: string | null;
          created_at: string;
        }>
      >();

      for (const r of (commentsRows as any[]) ?? []) {
        const arr = commentsMap.get(r.item_id) ?? [];
        arr.push({
          id: r.id,
          text: r.text,
          translation_text: r.translation_text ?? null,
          author_type: r.author_type ?? null,
          author_id: r.author_id ?? null,
          created_at: r.created_at,
        });
        commentsMap.set(r.item_id, arr);
      }

      const enriched = items.map((it: any) => ({
        ...it,
        actions: actionsMap.get(it.id) ?? [],
        comments: commentsMap.get(it.id) ?? [],
      }));

      return Response.json({ items: enriched });
    }

    /* =========================
       POST /api/admin/items
       ========================= */
    if (method === "POST") {
      const body = (await request.json().catch(() => null)) as null | {
        date: string;
        title: string;
        url: string;
        description: string;
        category_id?: string | null;
        action_ids?: string[];
        comments?: Array<string | CommentInput>;
        is_global?: boolean;
      };

      if (
        !body ||
        !isValidDate(body.date) ||
        !body.title ||
        !body.url ||
        !body.description
      ) {
        return Response.json({ error: "Invalid payload" }, { status: 400 });
      }

      const id = crypto.randomUUID();
      const createdAt = nowIso();

      const title = body.title.trim();
      const url = body.url.trim();
      const description = body.description.trim();
      const categoryId = body.category_id ? String(body.category_id) : null;

      const isGlobal = body.is_global ? 1 : 0;

      const uniqActionIds = normalizeIdList(body.action_ids, 20);
      const comments = normalizeComments(body.comments, 1000, 50);

      if (!title || !url || !description) {
        return Response.json({ error: "Invalid payload" }, { status: 400 });
      }

      const urlNorm = normalizeUrlForDedup(url);
      if (!urlNorm)
        return Response.json({ error: "Invalid url" }, { status: 400 });

      // Duplicate check:
      // - global items: unique among globals
      // - normal items: unique per date
      const dup = isGlobal
        ? await env.DB.prepare(
            `SELECT id FROM items WHERE is_global = 1 AND url_norm = ? LIMIT 1`,
          )
            .bind(urlNorm)
            .first()
        : await env.DB.prepare(
            `SELECT id FROM items WHERE date = ? AND url_norm = ? LIMIT 1`,
          )
            .bind(body.date, urlNorm)
            .first();

      if (dup) {
        return Response.json(
          { error: "Duplicate URL", code: "DUPLICATE_URL" },
          { status: 409 },
        );
      }

      if (categoryId) {
        const cat = await env.DB.prepare(
          `SELECT id FROM categories WHERE id = ?`,
        )
          .bind(categoryId)
          .first();
        if (!cat)
          return Response.json({ error: "Invalid category_id" }, { status: 400 });
      }

      let validActionIds: string[] = [];
      if (uniqActionIds.length > 0) {
        const placeholders = uniqActionIds.map(() => "?").join(",");
        const { results: rows } = await env.DB.prepare(
          `SELECT id FROM actions WHERE id IN (${placeholders})`,
        )
          .bind(...uniqActionIds)
          .all();

        validActionIds = ((rows as any[]) ?? []).map((r) => r.id);
      }

      await env.DB.prepare(
        `INSERT INTO items (id, date, title, url, url_norm, description, category_id, is_global, created_at, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          body.date,
          title,
          url,
          urlNorm,
          description,
          categoryId,
          isGlobal,
          createdAt,
          user.id,
        )
        .run();

      if (validActionIds.length > 0) {
        const stmt = env.DB.prepare(
          `INSERT INTO item_actions (item_id, action_id, created_at) VALUES (?, ?, ?)`,
        );
        const batch = validActionIds.map((aid) => stmt.bind(id, aid, createdAt));
        await env.DB.batch(batch);
      }

      if (comments.length > 0) {
        const authorType = user?.role ? String(user.role) : "admin";
        const authorId = user?.id ? String(user.id) : null;

        const stmt = env.DB.prepare(
          `INSERT INTO item_comments (id, item_id, text, translation_text, author_type, author_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        );

        const batch = comments.map((c) =>
          stmt.bind(
            crypto.randomUUID(),
            id,
            c.text,
            c.translation_text ?? null,
            authorType,
            authorId,
            createdAt,
          ),
        );

        await env.DB.batch(batch);
      }

      return Response.json({ ok: true, id });
    }

    /* =========================
       PUT /api/admin/items?id=...
       ========================= */
    if (method === "PUT") {
      const urlObj = new URL(request.url);
      const id = urlObj.searchParams.get("id");
      if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

      const body = (await request.json().catch(() => null)) as null | {
        title: string;
        url: string;
        description: string;
        category_id?: string | null;
        action_ids?: string[];
        comments?: Array<string | CommentInput>;
        is_global?: boolean;
      };

      if (!body || !body.title || !body.url || !body.description) {
        return Response.json({ error: "Invalid payload" }, { status: 400 });
      }

      const title = body.title.trim();
      const url = body.url.trim();
      const description = body.description.trim();
      const categoryId = body.category_id ?? null;
      const isGlobal = body.is_global ? 1 : 0;

      if (!title || !url || !description) {
        return Response.json({ error: "Invalid payload" }, { status: 400 });
      }

      const current = (await env.DB.prepare(
        `SELECT id, date FROM items WHERE id = ?`,
      )
        .bind(id)
        .first()) as any;

      if (!current) return Response.json({ error: "Not found" }, { status: 404 });

      const urlNorm = normalizeUrlForDedup(url);
      if (!urlNorm)
        return Response.json({ error: "Invalid url" }, { status: 400 });

      // Conflict check:
      // - global items: unique among globals
      // - normal items: unique per date
      const conflict = isGlobal
        ? await env.DB.prepare(
            `SELECT id FROM items WHERE is_global = 1 AND url_norm = ? AND id != ? LIMIT 1`,
          )
            .bind(urlNorm, id)
            .first()
        : await env.DB.prepare(
            `SELECT id FROM items WHERE date = ? AND url_norm = ? AND id != ? LIMIT 1`,
          )
            .bind(current.date, urlNorm, id)
            .first();

      if (conflict) {
        return Response.json(
          { error: "Duplicate URL", code: "DUPLICATE_URL" },
          { status: 409 },
        );
      }

      await env.DB.prepare(
        `UPDATE items
         SET title = ?, url = ?, url_norm = ?, description = ?, category_id = ?, is_global = ?
         WHERE id = ?`,
      )
        .bind(title, url, urlNorm, description, categoryId, isGlobal, id)
        .run();

      const createdAt = nowIso();

      // Replace actions
      await env.DB.prepare(`DELETE FROM item_actions WHERE item_id = ?`)
        .bind(id)
        .run();

      const actionIds = Array.isArray(body.action_ids) ? body.action_ids : [];
      for (const aid of actionIds) {
        const a = String(aid ?? "").trim();
        if (!a) continue;
        await env.DB.prepare(
          `INSERT INTO item_actions (item_id, action_id, created_at) VALUES (?, ?, ?)`,
        )
          .bind(id, a, createdAt)
          .run();
      }

      // Replace comments
      await env.DB.prepare(`DELETE FROM item_comments WHERE item_id = ? AND author_type != ?`)
        .bind(id, "ai")
        .run();

      const comments = normalizeComments(body.comments, 1000, 50);

      if (comments.length > 0) {
        const authorType = user?.role ? String(user.role) : "admin";
        const authorId = user?.id ? String(user.id) : null;

        const stmt = env.DB.prepare(
          `INSERT INTO item_comments (id, item_id, text, translation_text, author_type, author_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        );

        const batch = comments.map((c) =>
          stmt.bind(
            crypto.randomUUID(),
            id,
            c.text,
            c.translation_text ?? null,
            authorType,
            authorId,
            createdAt,
          ),
        );

        await env.DB.batch(batch);
      }

      return Response.json({ ok: true });
    }

    /* =========================
       DELETE /api/admin/items?id=...
       ========================= */
    if (method === "DELETE") {
      if (!requireRole(user, ["superadmin", "admin"])) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }

      const url = new URL(request.url);
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

      await env.DB.prepare(`DELETE FROM item_comments WHERE item_id = ?`)
        .bind(id)
        .run();
      await env.DB.prepare(`DELETE FROM item_actions WHERE item_id = ?`)
        .bind(id)
        .run();
      await env.DB.prepare(`DELETE FROM items WHERE id = ?`).bind(id).run();

      return Response.json({ ok: true });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (e: any) {
    return Response.json(
      { error: "items endpoint failed", message: String(e?.message ?? e) },
      { status: 500 },
    );
  }
};