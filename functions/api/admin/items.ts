type Env = {
  DB: D1Database;
};

function nowIso() {
  return new Date().toISOString();
}

function uuid() {
  // Good enough for ids in this app; you can replace with crypto.randomUUID() in workers runtime
  return crypto.randomUUID();
}

function getAccessEmail(req: Request): string | null {
  // Cloudflare Access (with "Inject identity headers" enabled)
  // Common header: Cf-Access-Authenticated-User-Email
  return req.headers.get("Cf-Access-Authenticated-User-Email");
}

async function ensureAdmin(env: Env, email: string) {
  const existing = await env.DB.prepare(
    `SELECT id, email FROM admins WHERE email = ?`
  ).bind(email).first<{ id: string; email: string }>();

  if (existing?.id) return existing.id;

  const id = uuid();
  await env.DB.prepare(
    `INSERT INTO admins (id, email, name, created_at) VALUES (?, ?, ?, ?)`
  ).bind(id, email, null, nowIso()).run();

  return id;
}

function isValidDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = getAccessEmail(request);
  if (!email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (!date || !isValidDate(date)) {
    return Response.json({ error: "Invalid date. Use YYYY-MM-DD" }, { status: 400 });
  }

  const { results } = await env.DB.prepare(
    `SELECT i.*, a.email AS created_by_email
     FROM items i
     LEFT JOIN admins a ON a.id = i.created_by_admin_id
     WHERE i.date = ?
     ORDER BY i.created_at DESC`
  ).bind(date).all();

  return Response.json({ items: results ?? [] });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = getAccessEmail(request);
  if (!email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const adminId = await ensureAdmin(env, email);

  const body = await request.json().catch(() => null) as null | {
    date: string;
    title: string;
    url: string;
    description: string;
    action_type?: string | null;
  };

  if (!body || !isValidDate(body.date) || !body.title || !body.url || !body.description) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const id = uuid();
  const createdAt = nowIso();

  await env.DB.prepare(
    `INSERT INTO items (id, date, title, url, description, action_type, created_at, created_by_admin_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.date,
    body.title.trim(),
    body.url.trim(),
    body.description.trim(),
    body.action_type ?? null,
    createdAt,
    adminId
  ).run();

  return Response.json({ ok: true, id });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const email = getAccessEmail(request);
  if (!email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  await env.DB.prepare(`DELETE FROM items WHERE id = ?`).bind(id).run();
  return Response.json({ ok: true });
};
