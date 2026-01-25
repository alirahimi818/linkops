import { hashPassword, requireAuth, requireRole } from "./_auth";
import type { EnvAuth } from "./_auth";

function nowIso() {
  return new Date().toISOString();
}

function isValidRole(role: string): boolean {
  return ["superadmin", "admin", "editor"].includes(role);
}

function isNonEmpty(s: unknown) {
  return typeof s === "string" && s.trim().length > 0;
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
        `SELECT id, username, email, role, name, avatar_url, bio, created_at
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
        name?: string | null;
        avatar_url?: string | null;
        bio?: string | null;
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
        `INSERT INTO users (id, username, password_hash, email, role, name, avatar_url, bio, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          id,
          username,
          password_hash,
          body.email ?? null,
          role,
          body.name ?? null,
          body.avatar_url ?? null,
          body.bio ?? null,
          nowIso()
        )
        .run();

      return Response.json({ ok: true, id });
    }

    if (request.method === "PATCH") {
      const url = new URL(request.url);
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

      const body = (await request.json().catch(() => null)) as null | {
        username?: string;
        password?: string;
        email?: string | null;
        role?: string;
        name?: string | null;
        avatar_url?: string | null;
        bio?: string | null;
      };

      if (!body) return Response.json({ error: "Invalid payload" }, { status: 400 });

      // Prevent editing your own role (optional safety)
      if (id === user.id && body.role && body.role.trim() !== user.role) {
        return Response.json({ error: "You cannot change your own role" }, { status: 400 });
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (typeof body.username !== "undefined") {
        if (!isNonEmpty(body.username)) {
          return Response.json({ error: "Username invalid" }, { status: 400 });
        }
        updates.push("username = ?");
        params.push(body.username.trim());
      }

      if (typeof body.email !== "undefined") {
        // allow null/empty
        const emailVal = body.email === null ? null : String(body.email ?? "").trim();
        updates.push("email = ?");
        params.push(emailVal ? emailVal : null);
      }

      if (typeof body.role !== "undefined") {
        const role = String(body.role ?? "").trim();
        if (!isValidRole(role)) {
          return Response.json({ error: "Invalid role" }, { status: 400 });
        }
        updates.push("role = ?");
        params.push(role);
      }

      if (typeof body.name !== "undefined") {
        const v = body.name === null ? null : String(body.name ?? "").trim();
        updates.push("name = ?");
        params.push(v ? v : null);
      }

      if (typeof body.avatar_url !== "undefined") {
        const v = body.avatar_url === null ? null : String(body.avatar_url ?? "").trim();
        updates.push("avatar_url = ?");
        params.push(v ? v : null);
      }

      if (typeof body.bio !== "undefined") {
        const v = body.bio === null ? null : String(body.bio ?? "").trim();
        updates.push("bio = ?");
        params.push(v ? v : null);
      }

      if (typeof body.password !== "undefined") {
        const pw = String(body.password ?? "");
        if (pw.length < 6) {
          return Response.json({ error: "Password invalid" }, { status: 400 });
        }
        const password_hash = await hashPassword(pw);
        updates.push("password_hash = ?");
        params.push(password_hash);
      }

      if (updates.length === 0) {
        return Response.json({ error: "Nothing to update" }, { status: 400 });
      }

      params.push(id);

      await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();
      return Response.json({ ok: true });
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