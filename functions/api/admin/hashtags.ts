// functions/api/admin/hashtags.ts
import { requireAuth, requireRole } from "./_auth";
import type { EnvAuth } from "./_auth";

function nowIso() {
  return new Date().toISOString();
}

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  try {
    const user = await requireAuth(env, request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!requireRole(user, ["superadmin"])) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    // GET — list all
    if (request.method === "GET") {
      const { results } = await env.DB.prepare(
        `SELECT id, tag, priority, is_active, created_at
         FROM hashtag_whitelist
         ORDER BY is_active DESC, priority DESC, tag ASC`,
      ).all();
      return Response.json({ hashtags: results ?? [] });
    }

    // POST — create
    if (request.method === "POST") {
      const body = (await request.json().catch(() => null)) as any;
      const tag = String(body?.tag ?? "").trim().replace(/^#/, "");
      if (!tag) {
        return Response.json({ error: "Missing tag" }, { status: 400 });
      }
      const priority = Number.isFinite(Number(body?.priority)) ? Number(body.priority) : 0;
      const is_active = body?.is_active === 0 ? 0 : 1;
      const newId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO hashtag_whitelist (id, tag, priority, is_active, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(newId, tag, priority, is_active, nowIso()).run();
      return Response.json({ ok: true, id: newId });
    }

    // PUT — update
    if (request.method === "PUT") {
      if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
      const body = (await request.json().catch(() => null)) as any;
      const fields: string[] = [];
      const binds: any[] = [];
      if (body?.tag !== undefined) {
        const tag = String(body.tag).trim().replace(/^#/, "");
        if (tag) { fields.push("tag = ?"); binds.push(tag); }
      }
      if (body?.priority !== undefined && Number.isFinite(Number(body.priority))) {
        fields.push("priority = ?"); binds.push(Number(body.priority));
      }
      if (body?.is_active !== undefined) {
        fields.push("is_active = ?"); binds.push(body.is_active === 0 ? 0 : 1);
      }
      if (fields.length === 0) {
        return Response.json({ error: "Nothing to update" }, { status: 400 });
      }
      binds.push(id);
      await env.DB.prepare(
        `UPDATE hashtag_whitelist SET ${fields.join(", ")} WHERE id = ?`,
      ).bind(...binds).run();
      return Response.json({ ok: true });
    }

    // DELETE
    if (request.method === "DELETE") {
      if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
      await env.DB.prepare(`DELETE FROM hashtag_whitelist WHERE id = ?`).bind(id).run();
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (e: any) {
    return Response.json(
      { error: "hashtags endpoint failed", message: String(e?.message ?? e) },
      { status: 500 },
    );
  }
};
