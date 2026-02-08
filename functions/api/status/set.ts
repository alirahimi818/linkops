// functions/api/status/set.ts
import type { EnvAuth } from "../admin/_auth";
import { requireDeviceId } from "../_device";

type SettableStatus = "later" | "done" | "hidden";
type IncomingStatus = SettableStatus | "todo" | null;

function isSettableStatus(v: any): v is SettableStatus {
  return v === "later" || v === "done" || v === "hidden";
}

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  try {
    await env.DB.exec("PRAGMA foreign_keys = ON;");

    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const deviceId = requireDeviceId(request);

    const body = await request.json().catch(() => null);
    const itemId = String(body?.item_id ?? "").trim();
    const status = (body?.status ?? null) as IncomingStatus;

    if (!itemId) {
      return Response.json({ error: "item_id is required" }, { status: 400 });
    }

    // Optional but recommended: validate item exists (better error, avoids FK issues)
    const itemExists = await env.DB.prepare(
      "SELECT 1 FROM items WHERE id = ? LIMIT 1",
    )
      .bind(itemId)
      .first<any>();

    if (!itemExists) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    // Treat "todo" same as null (clear status)
    if (status === null || status === "todo") {
      await env.DB.prepare(
        "DELETE FROM item_status WHERE device_id = ? AND item_id = ?",
      )
        .bind(deviceId, itemId)
        .run();

      return Response.json({ ok: true, status: "todo" });
    }

    if (!isSettableStatus(status)) {
      return Response.json(
        { error: "Invalid status (use later|done|hidden|null)" },
        { status: 400 },
      );
    }

    // Upsert
    await env.DB.prepare(
      `
      INSERT INTO item_status (device_id, item_id, status, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(device_id, item_id) DO UPDATE SET
        status = excluded.status,
        updated_at = CURRENT_TIMESTAMP
      `,
    )
      .bind(deviceId, itemId, status)
      .run();

    return Response.json({ ok: true, status });
  } catch (e: any) {
    return Response.json(
      { error: "status/set failed", message: String(e?.message ?? e) },
      { status: 500 },
    );
  }
};
