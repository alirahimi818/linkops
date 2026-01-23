type Env = { DB: D1Database };

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await env.DB.exec("PRAGMA foreign_keys = ON;");

    if (request.method !== "GET") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const { results } = await env.DB.prepare(
      `SELECT id, name, label, created_at
       FROM actions
       ORDER BY label ASC`
    ).all();

    return Response.json({ actions: results ?? [] });
  } catch (e: any) {
    return Response.json(
      { error: "actions public endpoint failed", message: String(e?.message ?? e) },
      { status: 500 }
    );
  }
};
