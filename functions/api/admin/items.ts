import { requireAuth, requireRole } from "./_auth";
import type { EnvAuth } from "./_auth";

function nowIso() {
  return new Date().toISOString();
}

function isValidDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  const user = await requireAuth(env, request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Allowed roles to manage items (adjust later)
  if (!requireRole(user, ["admin", "editor"])) {
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
              u.role     AS created_by_role
       FROM items i
       LEFT JOIN users u ON u.id = i.created_by_user_id
       WHERE i.date = ?
       ORDER BY i.created_at DESC`
    ).bind(date).all();

    return Response.json({ items: results ?? [] });
  }

  if (method === "POST") {
    const body = (await request.json().catch(() => null)) as null | {
      date: string;
      title: string;
      url: string;
      description: string;
      action_type?: string | null;
    };

    if (!body || !isValidDate(body.date) || !body.title || !body.url || !body.description) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    const id = crypto.randomUUID();

    await env.DB.prepare(
      `INSERT INTO items (id, date, title, url, description, action_type, created_at, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      body.date,
      body.title.trim(),
      body.url.trim(),
      body.description.trim(),
      body.action_type ?? null,
      nowIso(),
      user.id
    ).run();

    return Response.json({ ok: true, id });
  }

  if (method === "DELETE") {
    // You can restrict delete to admin only if you want
    if (!requireRole(user, ["admin"])) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

    await env.DB.prepare(`DELETE FROM items WHERE id = ?`).bind(id).run();
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
};
