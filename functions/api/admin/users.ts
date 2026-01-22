import { hashPassword, requireAuth, requireRole } from "./_auth";
import type { EnvAuth } from "./_auth";

function nowIso() {
  return new Date().toISOString();
}

function isValidRole(role: string): boolean {
  return ["superadmin", "admin", "editor"].includes(role);
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
        `SELECT id, username, email, role, created_at
         FROM users
         ORDER BY created_at DESC`
      ).all();

      return Response.json({ users: results ?? [] });
    }

    if (request.method === "POST") {
      const body = (await request.json().catch(() => null)) as null | {
        username: string;
        password: string;
        email?: string | null;
        role: string;
      };

      if (!body?.username || !body?.password || !body?.role) {
        return Response.json({ error: "Invalid payload" }, { status: 400 });
      }

      const username = body.username.trim();
      const role = body.role.trim();

      if (!username || body.password.length < 6) {
        return Response.json({ error: "Username or password invalid" }, { status: 400 });
      }

      if (!isValidRole(role)) {
        return Response.json({ error: "Invalid role" }, { status: 400 });
      }

      const id = crypto.randomUUID();
      const password_hash = await hashPassword(body.password);

      await env.DB.prepare(
        `INSERT INTO users (id, username, password_hash, email, role, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(id, username, password_hash, body.email ?? null, role, nowIso()).run();

      return Response.json({ ok: true, id });
    }

    if (request.method === "DELETE") {
      const url = new URL(request.url);
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

      if (id === user.id) {
        return Response.json({ error: "You cannot delete yourself" }, { status: 400 });
      }

      await env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(id).run();
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (e: any) {
    return Response.json(
      { error: "users endpoint failed", message: String(e?.message ?? e) },
      { status: 500 }
    );
  }
};
