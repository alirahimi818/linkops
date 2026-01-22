import { requireAuth, requireRole } from "./_auth";
import type { EnvAuth } from "./_auth";

function nowIso() {
  return new Date().toISOString();
}

function normalizeTag(tag: string): string {
  const t = tag.trim();
  const noHash = t.startsWith("#") ? t.slice(1) : t;
  return noHash.toLowerCase();
}

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  try {
    const user = await requireAuth(env, request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!requireRole(user, ["superadmin", "admin", "editor"])) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (request.method === "GET") {
      const { results } = await env.DB.prepare(
        `SELECT id, tag, priority, active, created_at, created_by_user_id
         FROM hashtag_whitelist
         ORDER BY active DESC, priority DESC, tag ASC`
      ).all();

      return Response.json({ hashtags: results ?? [] });
    }

    if (request.method === "POST") {
      const body = (await request.json().catch(() => null)) as null | {
        tag: string;
        priority?: number;
        active?: boolean;
      };

      if (!body?.tag) return Response.json({ error: "Invalid payload" }, { status: 400 });

      const tag = normalizeTag(body.tag);
      if (!tag || tag.length > 80) return Response.json({ error: "Invalid tag" }, { status: 400 });

      const id = crypto.randomUUID();
      const priority = Number.isFinite(body.priority) ? Number(body.priority) : 0;
      const active = body.active === false ? 0 : 1;

      await env.DB.prepare(
        `INSERT INTO hashtag_whitelist (id, tag, priority, active, created_at, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(id, tag, priority, active, nowIso(), user.id).run();

      return Response.json({ ok: true, id });
    }

    if (request.method === "PATCH") {
      const body = (await request.json().catch(() => null)) as null | {
        id: string;
        priority?: number;
        active?: boolean;
      };

      if (!body?.id) return Response.json({ error: "Invalid payload" }, { status: 400 });

      const updates: string[] = [];
      const binds: any[] = [];

      if (typeof body.priority === "number" && Number.isFinite(body.priority)) {
        updates.push("priority = ?");
        binds.push(body.priority);
      }

      if (typeof body.active === "boolean") {
        updates.push("active = ?");
        binds.push(body.active ? 1 : 0);
      }

      if (updates.length === 0) return Response.json({ error: "Nothing to update" }, { status: 400 });

      binds.push(body.id);
      await env.DB.prepare(`UPDATE hashtag_whitelist SET ${updates.join(", ")} WHERE id = ?`)
        .bind(...binds)
        .run();

      return Response.json({ ok: true });
    }

    if (request.method === "DELETE") {
      const url = new URL(request.url);
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

      await env.DB.prepare(`DELETE FROM hashtag_whitelist WHERE id = ?`).bind(id).run();
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (e: any) {
    return Response.json(
      { error: "hashtags endpoint failed", message: String(e?.message ?? e) },
      { status: 500 }
    );
  }
};
