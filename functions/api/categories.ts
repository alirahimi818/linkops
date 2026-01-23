type Env = {
  DB: D1Database;
};

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (request.method !== "GET") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const { results } = await env.DB.prepare(
        `SELECT id, name, image, created_at
         FROM categories
         ORDER BY name ASC`
      ).all();

    return Response.json({ categories: results ?? [] });
  } catch (e: any) {
    return Response.json(
      { error: "categories public endpoint failed", message: String(e?.message ?? e) },
      { status: 500 }
    );
  }
};
