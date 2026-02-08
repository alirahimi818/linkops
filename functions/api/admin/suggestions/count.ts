// functions/api/admin/suggestions/count.ts
import { requireAuth, requireRole } from "../_auth";
import type { EnvAuth } from "../_auth";

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  try {
    await env.DB.exec("PRAGMA foreign_keys = ON;");

    const user = await requireAuth(env, request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!requireRole(user, ["superadmin", "admin", "editor"])) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (request.method !== "GET") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const url = new URL(request.url);
    const status = String(url.searchParams.get("status") ?? "pending").trim();

    const allowed = new Set(["pending", "approved", "rejected", "deleted"]);
    const st = allowed.has(status) ? status : "pending";

    const row = await env.DB.prepare(
      `SELECT COUNT(1) AS cnt FROM item_suggestions WHERE status = ?`,
    )
      .bind(st)
      .first<any>();

    return Response.json({ ok: true, count: Number(row?.cnt ?? 0) });
  } catch (e: any) {
    return Response.json(
      { error: "admin suggestions count failed", message: String(e?.message ?? e) },
      { status: 500 },
    );
  }
};
