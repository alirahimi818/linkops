// functions/api/admin/items.ts
import { requireAuth, requireRole } from "./_auth";
import type { EnvAuth } from "./_auth";

function nowIso() {
  return new Date().toISOString();
}

function isValidDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function normalizeList(input: unknown, maxLen: number): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const v of input) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (!s) continue;
    if (s.length > maxLen) continue;
    out.push(s);
  }
  return out;
}

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  const user = await requireAuth(env, request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!requireRole(user, ["superadmin", "admin", "editor"])) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const method = request.method;

  if (method === "GET") {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    if (!date || !isValidDate(date)) {
      return Response.json({ error: "Invalid date. Use YYYY-MM-DD" }, { status: 400 });
    }

    const { results } = await env.DB.prepare(
      `SELECT i.*,
              u.username AS created_by_username,
              u.email    AS created_by_email,
              u.role     AS created_by_role,
              c.name     AS category_name
       FROM items i
       LEFT JOIN users u ON u.id = i.created_by_user_id
       LEFT JOIN categories c ON c.id = i.category_id
       WHERE i.date = ?
       ORDER BY i.created_at DESC`
    ).bind(date).all<any>();

    const items = results ?? [];
    const itemIds = items.map((x: any) => x.id);

    if (itemIds.length === 0) return Response.json({ items: [] });

    const placeholders = itemIds.map(() => "?").join(",");

    const { results: actionsRows } = await env.DB.prepare(
      `SELECT item_id, action, sort_order
       FROM item_actions
       WHERE item_id IN (${placeholders})
       ORDER BY item_id, sort_order ASC`
    ).bind(...itemIds).all<any>();

    const { results: commentsRows } = await env.DB.prepare(
      `SELECT item_id, id, text, created_at
       FROM item_comments
       WHERE item_id IN (${placeholders})
       ORDER BY item_id, created_at ASC`
    ).bind(...itemIds).all<any>();

    const actionsMap = new Map<string, string[]>();
    for (const r of actionsRows ?? []) {
      const arr = actionsMap.get(r.item_id) ?? [];
      arr.push(r.action);
      actionsMap.set(r.item_id, arr);
    }

    const commentsMap = new Map<string, Array<{ id: string; text: string; created_at: string }>>();
    for (const r of commentsRows ?? []) {
      const arr = commentsMap.get(r.item_id) ?? [];
      arr.push({ id: r.id, text: r.text, created_at: r.created_at });
      commentsMap.set(r.item_id, arr);
    }

    const enriched = items.map((it: any) => ({
      ...it,
      actions: actionsMap.get(it.id) ?? [],
      action_type: (actionsMap.get(it.id) ?? [])[0] ?? null, // backward compat
      comments: commentsMap.get(it.id) ?? [],
    }));

    return Response.json({ items: enriched });
  }

  if (method === "POST") {
    const body = (await request.json().catch(() => null)) as null | {
      date: string;
      title: string;
      url: string;
      description: string;
      category_id?: string | null;
      actions?: string[];
      comments?: string[];
    };

    if (!body || !isValidDate(body.date) || !body.title || !body.url || !body.description) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const title = body.title.trim();
    const url = body.url.trim();
    const description = body.description.trim();
    const categoryId = body.category_id ? String(body.category_id) : null;

    const actions = normalizeList(body.actions, 60).slice(0, 10);   // max 10 actions
    const comments = normalizeList(body.comments, 400).slice(0, 50); // max 50 comments

    if (!title || !url || !description) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Optional: validate category exists
    if (categoryId) {
      const cat = await env.DB.prepare(`SELECT id FROM categories WHERE id = ?`).bind(categoryId).first<any>();
      if (!cat) return Response.json({ error: "Invalid category_id" }, { status: 400 });
    }

    await env.DB.prepare(
      `INSERT INTO items (id, date, title, url, description, category_id, created_at, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      body.date,
      title,
      url,
      description,
      categoryId,
      nowIso(),
      user.id
    ).run();

    // actions
    let sortOrder = 1;
    for (const a of actions) {
      await env.DB.prepare(
        `INSERT INTO item_actions (id, item_id, action, sort_order)
         VALUES (?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), id, a, sortOrder++).run();
    }

    // comments
    for (const c of comments) {
      await env.DB.prepare(
        `INSERT INTO item_comments (id, item_id, text, created_at)
         VALUES (?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), id, c, nowIso()).run();
    }

    return Response.json({ ok: true, id });
  }

  if (method === "DELETE") {
    if (!requireRole(user, ["superadmin", "admin"])) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

    // delete children first
    await env.DB.prepare(`DELETE FROM item_actions WHERE item_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM item_comments WHERE item_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM items WHERE id = ?`).bind(id).run();

    return Response.json({ ok: true });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
};
