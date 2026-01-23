type Env = {
  DB: D1Database;
};

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (request.method !== "GET") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const { results } = await env.DB.prepare(
      `SELECT id, tag, priority, is_active, created_at
       FROM hashtag_whitelist
       ORDER BY is_active DESC, priority DESC, tag ASC`
    ).all();

    return Response.json({ hashtags: results ?? [] });
  } catch (e: any) {
    return Response.json(
      { error: "hashtags public endpoint failed", message: String(e?.message ?? e) },
      { status: 500 }
    );
  }
};
