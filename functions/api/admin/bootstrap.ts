import { hashPassword } from "./_auth";
import type { EnvAuth } from "./_auth";

type Payload = {
  username: string;
  password: string;
  email?: string | null;
  role?: string | null;
};

function safeJsonParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const raw = await request.text();
  const body = (safeJsonParse(raw) as Payload | null);

  if (!body) {
    return Response.json({ error: "Invalid JSON", raw }, { status: 400 });
  }

  if (!body.username || !body.password) {
    return Response.json({ error: "Invalid payload", received: body }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const password_hash = await hashPassword(body.password);
  const role = (body.role ?? "admin").trim() || "admin";

  await env.DB.prepare(
    `INSERT INTO users (id, username, password_hash, email, role, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.username.trim(),
    password_hash,
    body.email ?? null,
    role,
    new Date().toISOString()
  ).run();

  return Response.json({ ok: true, id, role });
};