// functions/api/items.ts
import type { EnvAuth } from "./admin/_auth";

function isValidDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  if (request.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (!date || !isValidDate(date)) {
    return Response.json({ error: "Invalid date. Use YYYY-MM-DD" }, { status: 400 });
  }

  const { results: items } = await env.DB.prepare(
    `SELECT i.*
     FROM items i
     WHERE i.date = ?
     ORDER BY i.created_at DESC`
  ).bind(date).all<any>();

  const itemIds = (items ?? []).map((x: any) => x.id);
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

  const enriched = (items ?? []).map((it: any) => {
    const actions = actionsMap.get(it.id) ?? [];
    return {
      ...it,
      actions,
      action_type: actions[0] ?? null, // backward compat
      comments: commentsMap.get(it.id) ?? [],
    };
  });

  return Response.json({ items: enriched });
};
