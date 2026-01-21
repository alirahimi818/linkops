import { signJwt, verifyPassword } from "./_auth";
import type { EnvAuth } from "./_auth";

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = (await request.json().catch(() => null)) as null | {
    username: string;
    password: string;
  };

  if (!body?.username || !body?.password) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const user = await env.DB.prepare(
    `SELECT id, username, email, role, password_hash FROM users WHERE username = ?`
  ).bind(body.username.trim()).first<{
    id: string;
    username: string;
    email: string | null;
    role: string;
    password_hash: string;
  }>();

  if (!user) return Response.json({ error: "Invalid credentials" }, { status: 401 });

  const ok = await verifyPassword(body.password, user.password_hash);
  if (!ok) return Response.json({ error: "Invalid credentials" }, { status: 401 });

  const token = await signJwt(env, {
    sub: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  });

  return Response.json({
    token,
    user: { username: user.username, email: user.email, role: user.role },
  });
};
