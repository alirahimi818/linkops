// functions/api/admin/hashtags.ts
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

    if (!requireRole(user, ["superadmin"])) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (request.method === "GET") {
      const { results } = await env.DB.prepare(
        `SELECT id, tag, priority, is_active, created_at
         FROM hashtag_whitelist
         ORDER BY is_active DESC, priority DESC, tag ASC`
      ).all();

      return Response.json({ hashtags: results ?? [] });
    }

    if (request.method === "POST") {
      const body = (await request.json().catch(() => null)) as null | {
        tag: string;
        priority?: number;
        is_active?: number; // 0/1
      };

      if (!body?.tag) return Response.json({ error: "Invalid payload" }, { status: 400 });

      const tag = normalizeTag(body.tag);
      if (!tag || tag.length > 80) return Response.json({ error: "Invalid tag" }, { status: 400 });

      const id = crypto.randomUUID();
      const priority = Number.isFinite(body.priority) ? Number(body.priority) : 0;
      const is_active = body.is_active === 0 ? 0 : 1;

      await env.DB.prepare(
        `INSERT INTO hashtag_whitelist (id, tag, priority, is_active, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(id, tag, priority, is_active, nowIso()).run();

      return Response.json({ ok: true, id });
    }

    if (request.method === "PUT") {
      const url = new URL(request.url);
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

      const body = (await request.json().catch(() => null)) as null | {
        tag?: string;
        priority?: number;
        is_active?: number; // 0/1
      };

      if (!body) return Response.json({ error: "Invalid payload" }, { status: 400 });

      const updates: string[] = [];
      const binds: any[] = [];

      if (typeof body.tag === "string") {
        const t = normalizeTag(body.tag);
        if (!t || t.length > 80) return Response.json({ error: "Invalid tag" }, { status: 400 });
        updates.push("tag = ?");
        binds.push(t);
      }

      if (typeof body.priority === "number" && Number.isFinite(body.priority)) {
        updates.push("priority = ?");
        binds.push(body.priority);
      }

      if (typeof body.is_active === "number") {
        const v = body.is_active === 0 ? 0 : 1;
        updates.push("is_active = ?");
        binds.push(v);
      }

      if (updates.length === 0) return Response.json({ error: "Nothing to update" }, { status: 400 });

      binds.push(id);

      await env.DB.prepare(
        `UPDATE hashtag_whitelist SET ${updates.join(", ")} WHERE id = ?`
      ).bind(...binds).run();

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
