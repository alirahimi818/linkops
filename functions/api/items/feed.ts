// functions/api/items/feed.ts
import { rateLimitByDevice, rateLimitResponse } from "../_rate_limit";
import type { EnvAuth } from "../admin/_auth";

type FeedTab = "todo" | "later" | "done" | "hidden";

function isValidDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function clampInt(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function encodeCursor(payload: { created_at: string; id: string }) {
  return btoa(JSON.stringify(payload));
}

function decodeCursor(
  raw: string | null,
): { created_at: string; id: string } | null {
  if (!raw) return null;
  try {
    const txt = atob(raw);
    const obj = JSON.parse(txt);
    if (!obj || typeof obj !== "object") return null;
    const created_at = String((obj as any).created_at ?? "");
    const id = String((obj as any).id ?? "");
    if (!created_at || !id) return null;
    return { created_at, id };
  } catch {
    return null;
  }
}

function getDeviceId(request: Request): string {
  // Client sets: headers.set("X-Device-Id", getDeviceId())
  const v = request.headers.get("X-Device-Id");
  return String(v ?? "").trim();
}

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  try {
    await env.DB.exec("PRAGMA foreign_keys = ON;");

    if (request.method !== "GET") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const deviceId = getDeviceId(request);
    if (!deviceId) {
      return Response.json(
        { error: "Missing X-Device-Id header" },
        { status: 400 },
      );
    }

    const rl = await rateLimitByDevice({
      db: env.DB,
      deviceId,
      action: "items_feed",
      rule: { windowSec: 60, limit: 300 },
    });

    if (!rl.ok) return rateLimitResponse(rl.retry_after);

    const url = new URL(request.url);

    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    const tab = (url.searchParams.get("tab") ?? "todo") as FeedTab;
    const cat = url.searchParams.get("cat") ?? "all";

    const limitRaw = Number(url.searchParams.get("limit") ?? "10");
    const limit = clampInt(limitRaw, 1, 50);

    const cursor = decodeCursor(url.searchParams.get("cursor"));

    if (!isValidDate(from) || !isValidDate(to)) {
      return Response.json(
        { error: "Invalid date range. Use YYYY-MM-DD" },
        { status: 400 },
      );
    }

    const validTab: FeedTab =
      tab === "todo" || tab === "later" || tab === "done" || tab === "hidden"
        ? tab
        : "todo";

    // ----------------------------
    // 1) Counts for tabs (range + cat)
    // NOTE: We assume "todo" is represented by NO ROW in item_status.
    // ----------------------------
    let countsWhere = `
      (
        i.is_global = 1
        OR (i.date >= ? AND i.date <= ?)
      )
    `;
    const countsBinds: any[] = [from, to];

    if (cat && cat !== "all") {
      if (cat === "__other__") {
        countsWhere += ` AND i.category_id IS NULL `;
      } else {
        countsWhere += ` AND i.category_id = ? `;
        countsBinds.push(cat);
      }
    }

    // Table name assumption:
    // item_status(device_id TEXT, item_id TEXT, status TEXT, updated_at TEXT, PRIMARY KEY(device_id,item_id))
    // If your table name differs, replace it here and in the feed query below.
    const countsSql = `
      SELECT
        SUM(CASE WHEN s.status IS NULL THEN 1 ELSE 0 END) AS todo,
        SUM(CASE WHEN s.status = 'later' THEN 1 ELSE 0 END) AS later,
        SUM(CASE WHEN s.status = 'done' THEN 1 ELSE 0 END) AS done,
        SUM(CASE WHEN s.status = 'hidden' THEN 1 ELSE 0 END) AS hidden
      FROM items i
      LEFT JOIN item_status s
        ON s.item_id = i.id AND s.device_id = ?
      WHERE ${countsWhere}
    `;

    const countsRow = await env.DB.prepare(countsSql)
      .bind(deviceId, ...countsBinds)
      .first<any>();

    const counts = {
      todo: Number(countsRow?.todo ?? 0),
      later: Number(countsRow?.later ?? 0),
      done: Number(countsRow?.done ?? 0),
      hidden: Number(countsRow?.hidden ?? 0),
    };

    // ----------------------------
    // 2) Feed items page (range + cat + tab + cursor)
    // Order: newest first (created_at DESC, id DESC)
    // Cursor is a tuple: (created_at, id)
    // ----------------------------
    let where = `
      (
        i.is_global = 1
        OR (i.date >= ? AND i.date <= ?)
      )
    `;
    const binds: any[] = [from, to];

    if (cat && cat !== "all") {
      if (cat === "__other__") {
        where += ` AND i.category_id IS NULL `;
      } else {
        where += ` AND i.category_id = ? `;
        binds.push(cat);
      }
    }

    if (validTab === "todo") {
      where += ` AND s.status IS NULL `;
    } else {
      where += ` AND s.status = ? `;
      binds.push(validTab);
    }

    if (cursor) {
      where += `
        AND (
          i.created_at < ?
          OR (i.created_at = ? AND i.id < ?)
        )
      `;
      binds.push(cursor.created_at, cursor.created_at, cursor.id);
    }

    const itemsSql = `
      SELECT
        i.*,
        c.name  AS category_name,
        c.image AS category_image,
        COALESCE(s.status, 'todo') AS user_status
      FROM items i
      LEFT JOIN categories c ON c.id = i.category_id
      LEFT JOIN item_status s
        ON s.item_id = i.id AND s.device_id = ?
      WHERE ${where}
      ORDER BY i.created_at DESC, i.id DESC
      LIMIT ?
    `;

    const { results } = await env.DB.prepare(itemsSql)
      .bind(deviceId, ...binds, limit)
      .all<any>();

    const items: any[] = results ?? [];
    const itemIds = items.map((x) => x.id);

    if (itemIds.length === 0) {
      return Response.json({ items: [], counts, next_cursor: null });
    }

    // ----------------------------
    // 3) Attach actions/comments for these item_ids (no JOIN explosion)
    // ----------------------------
    const placeholders = itemIds.map(() => "?").join(",");

    const { results: actionRows } = await env.DB.prepare(
      `
      SELECT
        ia.item_id,
        a.id    AS id,
        a.name  AS name,
        a.label AS label,
        a.created_at AS created_at
      FROM item_actions ia
      JOIN actions a ON a.id = ia.action_id
      WHERE ia.item_id IN (${placeholders})
      ORDER BY ia.item_id ASC, a.label ASC
      `,
    )
      .bind(...itemIds)
      .all<any>();

    const { results: commentRows } = await env.DB.prepare(
      `
      SELECT
        item_id,
        id,
        text,
        translation_text,
        author_type,
        author_id,
        created_at
      FROM item_comments
      WHERE item_id IN (${placeholders})
      ORDER BY item_id ASC, created_at ASC
      `,
    )
      .bind(...itemIds)
      .all<any>();

    const actionsMap = new Map<string, any[]>();
    for (const r of (actionRows ?? []) as any[]) {
      const arr = actionsMap.get(r.item_id) ?? [];
      arr.push({
        id: r.id,
        name: r.name,
        label: r.label,
        created_at: r.created_at,
      });
      actionsMap.set(r.item_id, arr);
    }

    const commentsMap = new Map<string, any[]>();
    for (const r of (commentRows ?? []) as any[]) {
      const arr = commentsMap.get(r.item_id) ?? [];
      arr.push({
        id: r.id,
        item_id: r.item_id,
        text: r.text,
        translation_text: r.translation_text ?? null,
        author_type: r.author_type ?? null,
        author_id: r.author_id ?? null,
        created_at: r.created_at,
      });
      commentsMap.set(r.item_id, arr);
    }

    const enriched = items.map((it) => ({
      ...it,
      actions: actionsMap.get(it.id) ?? [],
      comments: commentsMap.get(it.id) ?? [],
    }));

    // ----------------------------
    // 4) next_cursor
    // ----------------------------
    const last = enriched[enriched.length - 1];
    const next_cursor =
      last?.created_at && last?.id
        ? encodeCursor({
            created_at: String(last.created_at),
            id: String(last.id),
          })
        : null;

    return Response.json({
      items: enriched,
      counts,
      next_cursor,
    });
  } catch (e: any) {
    return Response.json(
      { error: "items feed endpoint failed", message: String(e?.message ?? e) },
      { status: 500 },
    );
  }
};
