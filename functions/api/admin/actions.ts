import { requireAuth, requireRole } from "./_auth";
import type { EnvAuth } from "./_auth";

function nowIso() {
  return new Date().toISOString();
}

function normalizeName(v: string) {
  return v.trim().toLowerCase();
}

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  try {
    await env.DB.exec("PRAGMA foreign_keys = ON;");

    const user = await requireAuth(env, request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!requireRole(user, ["superadmin"])) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (request.method === "GET") {
      const { results } = await env.DB.prepare(
        `SELECT id, name, label, created_at
         FROM actions
         ORDER BY label ASC`
      ).all();

      return Response.json({ actions: results ?? [] });
    }

    if (request.method === "POST") {
      const body = (await request.json().catch(() => null)) as null | { name: string; label: string };
      const name = body?.name ? normalizeName(body.name) : "";
      const label = body?.label?.trim() ?? "";

      if (!name || name.length > 40) return Response.json({ error: "Invalid name" }, { status: 400 });
      if (!label || label.length > 60) return Response.json({ error: "Invalid label" }, { status: 400 });

      const id = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO actions (id, name, label, created_at)
         VALUES (?, ?, ?, ?)`
      ).bind(id, name, label, nowIso()).run();

      return Response.json({ ok: true, id });
    }

    if (request.method === "PUT") {
      const url = new URL(request.url);
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

      const body = (await request.json().catch(() => null)) as null | { name?: string; label?: string };
      if (!body) return Response.json({ error: "Invalid payload" }, { status: 400 });

      const updates: string[] = [];
      const binds: any[] = [];

      if (typeof body.name === "string") {
        const name = normalizeName(body.name);
        if (!name || name.length > 40) return Response.json({ error: "Invalid name" }, { status: 400 });
        updates.push("name = ?");
        binds.push(name);
      }

      if (typeof body.label === "string") {
        const label = body.label.trim();
        if (!label || label.length > 60) return Response.json({ error: "Invalid label" }, { status: 400 });
        updates.push("label = ?");
        binds.push(label);
      }

      if (updates.length === 0) return Response.json({ error: "Nothing to update" }, { status: 400 });

      binds.push(id);

      await env.DB.prepare(
        `UPDATE actions SET ${updates.join(", ")} WHERE id = ?`
      ).bind(...binds).run();

      return Response.json({ ok: true });
    }

    if (request.method === "DELETE") {
      const url = new URL(request.url);
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

      // ON DELETE CASCADE will remove rows from item_actions
      await env.DB.prepare(`DELETE FROM actions WHERE id = ?`).bind(id).run();

      return Response.json({ ok: true });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (e: any) {
    return Response.json(
      { error: "admin actions endpoint failed", message: String(e?.message ?? e) },
      { status: 500 }
    );
  }
};
