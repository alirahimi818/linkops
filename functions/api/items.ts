// functions/api/items.ts
import { requireDeviceId } from "./_device";
import type { EnvAuth } from "./admin/_auth";

function isValidDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  try {
    await env.DB.exec("PRAGMA foreign_keys = ON;");

    if (request.method !== "GET") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const deviceId = requireDeviceId(request);

    const url = new URL(request.url);
    const itemId = url.searchParams.get("item_id");
    const date = url.searchParams.get("date");

    if (!date || !isValidDate(date)) {
      return Response.json(
        { error: "Invalid date. Use YYYY-MM-DD" },
        { status: 400 },
      );
    }

    let itemsQuery = `
      SELECT i.*,
             c.name  AS category_name,
             c.image AS category_image,
             COALESCE(s.status, 'todo') AS user_status
      FROM items i
      LEFT JOIN categories c ON c.id = i.category_id
      LEFT JOIN item_status s
        ON s.item_id = i.id
       AND s.device_id = ?
      WHERE 1=1
    `;

    const binds: any[] = [deviceId];

    if (itemId) {
      itemsQuery += ` AND i.id = ? `;
      binds.push(itemId);
    } else {
      itemsQuery += ` AND (i.date = ? OR i.is_global = 1) `;
      binds.push(date);
    }

    itemsQuery += ` ORDER BY i.is_global DESC, i.created_at DESC`;

    const { results } = await env.DB.prepare(itemsQuery).bind(...binds).all<any>();

    const items: any[] = results ?? [];
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
      .all<any>();

    const { results: commentsRows } = await env.DB.prepare(
      `SELECT item_id, id, text, translation_text, created_at
       FROM item_comments
       WHERE item_id IN (${placeholders})
       ORDER BY item_id, created_at ASC`,
    )
      .bind(...itemIds)
      .all<any>();

    const actionsMap = new Map<string, Array<{ id: string; name: string; label: string }>>();
    for (const r of (actionRows ?? []) as any[]) {
      const arr = actionsMap.get(r.item_id) ?? [];
      arr.push({ id: r.id, name: r.name, label: r.label });
      actionsMap.set(r.item_id, arr);
    }

    const commentsMap = new Map<
      string,
      Array<{ id: string; text: string; translation_text: string | null; created_at: string }>
    >();

    for (const r of (commentsRows ?? []) as any[]) {
      const arr = commentsMap.get(r.item_id) ?? [];
      arr.push({
        id: r.id,
        text: r.text,
        translation_text: r.translation_text ?? null,
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
  } catch (e: any) {
    return Response.json(
      { error: "items endpoint failed", message: String(e?.message ?? e) },
      { status: 500 },
    );
  }
};
