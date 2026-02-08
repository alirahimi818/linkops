import type { EnvAuth } from "../admin/_auth";
import { requireDeviceId } from "../_device";

function isValidDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

type TabCounts = { todo: number; later: number; done: number; hidden: number };

function emptyTabs(): TabCounts {
  return { todo: 0, later: 0, done: 0, hidden: 0 };
}

function addTab(tabs: TabCounts, s: string, n: number) {
  if (s === "later") tabs.later += n;
  else if (s === "done") tabs.done += n;
  else if (s === "hidden") tabs.hidden += n;
  else tabs.todo += n;
}

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  try {
    await env.DB.exec("PRAGMA foreign_keys = ON;");

    if (request.method !== "GET") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const deviceId = requireDeviceId(request);
    const url = new URL(request.url);

    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";

    if (!isValidDate(from) || !isValidDate(to)) {
      return Response.json(
        { error: "Invalid from/to (YYYY-MM-DD)" },
        { status: 400 },
      );
    }

    // 1) Tabs across range + globals
    const tabRows = await env.DB.prepare(
      `
      SELECT COALESCE(s.status, 'todo') AS status, COUNT(*) AS cnt
      FROM items i
      LEFT JOIN item_status s
        ON s.item_id = i.id
       AND s.device_id = ?
      WHERE (i.date BETWEEN ? AND ?) OR i.is_global = 1
      GROUP BY COALESCE(s.status, 'todo')
      `,
    )
      .bind(deviceId, from, to)
      .all<any>();

    const tabs = emptyTabs();
    for (const r of (tabRows.results ?? []) as any[]) {
      addTab(tabs, String(r.status), Number(r.cnt ?? 0));
    }

    // 2) Category counts (total items per category, independent of status)
    // "__other__" if category_id is NULL or category missing
    const catRows = await env.DB.prepare(
      `
      SELECT
        CASE
          WHEN i.category_id IS NULL THEN '__other__'
          WHEN c.id IS NULL THEN '__other__'
          ELSE c.id
        END AS cid,
        COUNT(*) AS cnt
      FROM items i
      LEFT JOIN categories c ON c.id = i.category_id
      WHERE (i.date BETWEEN ? AND ?) OR i.is_global = 1
      GROUP BY cid
      ORDER BY cnt DESC
      `,
    )
      .bind(from, to)
      .all<any>();

    const countsByCid = new Map<string, number>();
    for (const r of (catRows.results ?? []) as any[]) {
      countsByCid.set(String(r.cid), Number(r.cnt ?? 0));
    }

    // totalCount should include everything in range + globals, even if we hide zero-count categories
    let totalCount = 0;
    for (const n of countsByCid.values()) totalCount += n;

    // Pull all categories once (for name/image)
    const allCats = await env.DB.prepare(
      `SELECT id, name, image FROM categories`,
    ).all<any>();

    const catMeta = new Map<string, { name: string; image: string | null }>();
    for (const c of (allCats.results ?? []) as any[]) {
      catMeta.set(String(c.id), { name: String(c.name), image: c.image ?? null });
    }

    // Build categories (ONLY count > 0)
    const categoriesRaw = Array.from(countsByCid.entries())
      .map(([cid, cnt]) => {
        if (cid === "__other__") {
          return { id: "__other__", name: "سایر", image: null, count: cnt };
        }

        const meta = catMeta.get(cid);
        return {
          id: cid,
          name: meta?.name ?? "سایر",
          image: meta?.image ?? null,
          count: cnt,
        };
      })
      .filter((x) => Number(x.count ?? 0) > 0); // <-- hide zero-count categories (including __other__)

    // Sort by count desc, keep __other__ at end when present
    categoriesRaw.sort((a, b) => {
      if (a.id === "__other__") return 1;
      if (b.id === "__other__") return -1;
      return b.count - a.count;
    });

    return Response.json({
      range: { from, to },
      tabs,
      categories: [
        { id: "all", name: "نمایش همه", image: null, count: totalCount, isAll: true },
        ...categoriesRaw,
      ],
    });
  } catch (e: any) {
    return Response.json(
      { error: "items/summary failed", message: String(e?.message ?? e) },
      { status: 500 },
    );
  }
};
