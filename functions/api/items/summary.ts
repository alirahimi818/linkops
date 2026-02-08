// functions/api/items/summary.ts
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

    // 1) Tabs across range + globals (device-aware)
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

    // totalCount = all items in range + globals (even if category_id is null)
    const totalCountRow = await env.DB.prepare(
      `
      SELECT COUNT(*) AS cnt
      FROM items i
      WHERE (i.date BETWEEN ? AND ?) OR i.is_global = 1
      `,
    )
      .bind(from, to)
      .first<any>();

    const totalCount = Number(totalCountRow?.cnt ?? 0);

    // 2) Category counts:
    // - return real categories with cnt>0
    // - return "__other__" only if it has cnt>0
    //
    // "__other__" means:
    // - i.category_id IS NULL
    // - or category missing (deleted/invalid FK legacy)
    const catRows = await env.DB.prepare(
      `
      SELECT
        CASE
          WHEN i.category_id IS NULL THEN '__other__'
          WHEN c.id IS NULL THEN '__other__'
          ELSE c.id
        END AS id,
        CASE
          WHEN i.category_id IS NULL THEN 'سایر'
          WHEN c.id IS NULL THEN 'سایر'
          ELSE c.name
        END AS name,
        CASE
          WHEN i.category_id IS NULL THEN NULL
          WHEN c.id IS NULL THEN NULL
          ELSE c.image
        END AS image,
        COUNT(*) AS cnt
      FROM items i
      LEFT JOIN categories c ON c.id = i.category_id
      WHERE (i.date BETWEEN ? AND ?) OR i.is_global = 1
      GROUP BY id, name, image
      HAVING COUNT(*) > 0
      ORDER BY cnt DESC
      `,
    )
      .bind(from, to)
      .all<any>();

    const categoriesRaw = (catRows.results ?? [])
      .map((r: any) => ({
        id: String(r.id),
        name: String(r.name),
        image: r.image ?? null,
        count: Number(r.cnt ?? 0),
      }))
      // safety: ensure no zero sneaks in
      .filter((x: any) => Number.isFinite(x.count) && x.count > 0);

    // optional UX: keep "__other__" at the end even if it has count>0
    categoriesRaw.sort((a, b) => {
      if (a.id === "__other__") return 1;
      if (b.id === "__other__") return -1;
      return b.count - a.count;
    });

    return Response.json({
      range: { from, to },
      tabs,
      categories: [
        {
          id: "all",
          name: "نمایش همه",
          image: null,
          count: totalCount,
          isAll: true,
        },
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
