// functions/api/admin/categories.ts
import { requireAuth, requireRole } from "./_auth";
import type { EnvAuth } from "./_auth";

function nowIso() {
  return new Date().toISOString();
}

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  const user = await requireAuth(env, request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!requireRole(user, ["superadmin", "admin", "editor"])) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (request.method === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT id, name, created_at, created_by_user_id
       FROM categories
       ORDER BY name ASC`
    ).all<any>();

    return Response.json({ categories: results ?? [] });
  }

  if (request.method === "POST") {
    const body = (await request.json().catch(() => null)) as null | { name: string };
    const name = body?.name?.trim();
    if (!name || name.length > 60) {
      return Response.json({ error: "Invalid name" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO categories (id, name, created_at, created_by_user_id)
       VALUES (?, ?, ?, ?)`
    ).bind(id, name, nowIso(), user.id).run();

    return Response.json({ ok: true, id });
  }

  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

    // prevent delete if used
    const used = await env.DB.prepare(`SELECT 1 FROM items WHERE category_id = ? LIMIT 1`).bind(id).first<any>();
    if (used) return Response.json({ error: "Category in use" }, { status: 400 });

    await env.DB.prepare(`DELETE FROM categories WHERE id = ?`).bind(id).run();
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
};
