type Env = {
  DB: D1Database;
};

function isValidDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const date = url.searchParams.get("date");

  if (!date || !isValidDate(date)) {
    return Response.json({ error: "Invalid date. Use YYYY-MM-DD" }, { status: 400 });
  }

  const { results } = await env.DB.prepare(
    `SELECT id, date, title, url, description, action_type, created_at
     FROM items
     WHERE date = ?
     ORDER BY created_at DESC`
  ).bind(date).all();

  return Response.json({ items: results ?? [] });
};
