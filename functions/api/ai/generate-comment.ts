import {
  createAIJob,
  getRandomItemCommentExamples,
  runPublicCommentFromExamples,
  insertItemComment,
} from "../../_lib/ai/runner";
import { rateLimitByDevice, rateLimitResponse } from "../_rate_limit";
import { requireDeviceId } from "../_device";
import type { Tone } from "../../_lib/ai/types";

export function normalizeTone(v: any): Tone {
  const t = String(v || "").trim().toLowerCase();
  if (t === "angry") return "angry";
  if (t === "outraged") return "outraged";
  if (t === "demanding") return "demanding";
  if (t === "urgent") return "urgent";
  if (t === "sad") return "sad";
  if (t === "hopeful") return "hopeful";
  if (t === "defiant") return "defiant";
  if (t === "sarcastic") return "sarcastic";
  if (t === "calm_firm") return "calm_firm";
  if (t === "neutral") return "neutral";
  return "demanding";
}

async function getAllowedHashtagsFromDb(env: Env): Promise<string[]> {
  const res = await env.DB.prepare(
    `SELECT tag
     FROM hashtag_whitelist
     WHERE is_active = 1
     ORDER BY priority DESC, tag ASC`,
  ).all<any>();

  return (res.results || [])
    .map((r) => String(r.tag || "").trim())
    .filter(Boolean);
}

function normalizeExamples(examples: Array<{ text: string }>) {
  return (examples || [])
    .map((e) => ({ text: String(e.text || "").trim() }))
    .filter((e) => e.text.length > 0)
    .slice(0, 10);
}

export async function onRequestPost(ctx: any): Promise<Response> {
  const { request, env } = ctx;

  try {
    // Device ID is required (middleware already validated it)
    let deviceId: string;
    try {
      deviceId = requireDeviceId(request);
    } catch {
      return Response.json({ ok: false, error: "MISSING_DEVICE_ID" }, { status: 400 });
    }

    const body = await request.json();

    const item_id = String(body.item_id || "").trim();
    if (!item_id) {
      return Response.json(
        { ok: false, error: "MISSING_ITEM_ID" },
        { status: 400 },
      );
    }

    // Fetch item from DB
    const item = await env.DB.prepare(
      `SELECT id, title, url, description FROM items WHERE id = ? LIMIT 1`,
    )
      .bind(item_id)
      .first<any>();

    if (!item) {
      return Response.json({ ok: false, error: "ITEM_NOT_FOUND" }, { status: 404 });
    }

    // Rate limit: 1 per minute per device per item
    const rl = await rateLimitByDevice({
      db: env.DB,
      deviceId,
      action: "ai_comment_public",
      sub_key: item_id,
    });

    if (!rl.ok) {
      return rateLimitResponse(rl.retry_after);
    }

    const examplesRaw = await getRandomItemCommentExamples(env, item_id, 10, ["admin", "superadmin"]);
    const examples = normalizeExamples(examplesRaw);

    if (examples.length === 0) {
      return Response.json(
        { ok: false, error: "NO_EXAMPLES_AVAILABLE" },
        { status: 422 },
      );
    }

    const allowed_hashtags = await getAllowedHashtagsFromDb(env);

    const tone = normalizeTone(body.tone);
    const title_fa = String(item.title || "").trim();
    const description_fa = String(item.description || "").trim();

    const job = await createAIJob(env, {
      job_type: "generate_item_comment_public",
      target_type: "item",
      target_id: item_id,
      requested_by_type: "public",
      requested_by_id: null,
    });

    const result = await runPublicCommentFromExamples(env, {
      job_id: job.id,
      title_fa,
      description_fa,
      tone,
      allowed_hashtags,
      examples,
    });

    const saved = await insertItemComment(env, {
      item_id,
      text: result.text,
      translation_text: result.translation_text,
      author_type: "user",
      author_id: null,
    });

    return Response.json({
      ok: true,
      job_id: job.id,
      comment: { text: result.text, translation_text: result.translation_text },
      saved_comment_id: saved.id,
    });
  } catch (e: any) {
    console.error("public generate-comment failed:", e);

    return new Response(
      JSON.stringify({
        error: "INTERNAL_ERROR",
        message: e?.message ? String(e.message) : "unknown",
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
