import { hashPassword, requireAuth } from "./_auth";
import type { EnvAuth } from "./_auth";

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  try {
    const user = await requireAuth(env, request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (request.method === "GET") {
      const row = await env.DB.prepare(
        `SELECT id, username, email, role, name, avatar_url, bio, created_at
         FROM users WHERE id = ?`
      ).bind(user.id).first();

      return Response.json({ user: row });
    }

    if (request.method === "PATCH") {
      const body = (await request.json().catch(() => null)) as null | {
        email?: string | null;
        name?: string | null;
        avatar_url?: string | null;
        bio?: string | null;
        password?: string; // optional
      };

      if (!body) return Response.json({ error: "Invalid payload" }, { status: 400 });

      const updates: string[] = [];
      const params: any[] = [];

      if ("email" in body) {
        const v = body.email === null ? null : String(body.email ?? "").trim();
        updates.push("email = ?");
        params.push(v ? v : null);
      }

      if ("name" in body) {
        const v = body.name === null ? null : String(body.name ?? "").trim();
        updates.push("name = ?");
        params.push(v ? v : null);
      }

      if ("avatar_url" in body) {
        const v = body.avatar_url === null ? null : String(body.avatar_url ?? "").trim();
        updates.push("avatar_url = ?");
        params.push(v ? v : null);
      }

      if ("bio" in body) {
        const v = body.bio === null ? null : String(body.bio ?? "").trim();
        updates.push("bio = ?");
        params.push(v ? v : null);
      }

      if ("password" in body) {
        const pw = String(body.password ?? "");
        if (pw.trim().length > 0) {
          if (pw.length < 6) return Response.json({ error: "Password invalid" }, { status: 400 });
          const password_hash = await hashPassword(pw);
          updates.push("password_hash = ?");
          params.push(password_hash);
        }
      }

      if (updates.length === 0) {
        return Response.json({ error: "Nothing to update" }, { status: 400 });
      }

      params.push(user.id);
      await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

      return Response.json({ ok: true });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (e: any) {
    return Response.json(
      { error: "me endpoint failed", message: String(e?.message ?? e) },
      { status: 500 }
    );
  }
};
