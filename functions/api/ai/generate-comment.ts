import {
  createAIJob,
  getRandomItemCommentExamples,
  runGenerateCommentsJob,
  insertItemComment,
} from "../../_lib/ai/runner";
import type { GenerateInput, Tone } from "../../_lib/ai/types";

function normalizeTone(v: any): Tone {
  const t = String(v || "").trim();
  if (t === "friendly") return "friendly";
  if (t === "formal") return "formal";
  if (t === "neutral") return "neutral";
  if (t === "witty") return "witty";
  if (t === "professional") return "professional";
  return "neutral";
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
    .slice(0, 8);
}

export async function onRequestPost(ctx: any): Promise<Response> {
  const { request, env } = ctx;

  try {
    const body = await request.json();

    const item_id = String(body.item_id || "").trim();
    if (!item_id) {
      return Response.json(
        { ok: false, error: "MISSING_ITEM_ID" },
        { status: 400 },
      );
    }

    const title_fa = String(body.title_fa || "").trim();
    const description_fa = String(body.description_fa || "").trim();
    const need_fa = String(body.need_fa || "").trim();

    if (!title_fa || !description_fa || !need_fa) {
      return Response.json(
        { ok: false, error: "MISSING_REQUIRED_FIELDS" },
        { status: 400 },
      );
    }

    const examplesRaw = await getRandomItemCommentExamples(env, item_id, 5);
    const examples = normalizeExamples(examplesRaw);

    const allowed_hashtags = await getAllowedHashtagsFromDb(env);

    const input: GenerateInput = {
      title_fa,
      description_fa,
      need_fa,
      comment_type_fa: String(body.comment_type_fa || "ریپلای کوتاه").trim(),
      tone: normalizeTone(body.tone),

      stream: "political",
      topic: "iran_revolution_jan_2026",

      allowed_hashtags,
      count: 1,

      examples,
    };

    const job = await createAIJob(env, {
      job_type: "generate_item_comment_public",
      target_type: "item",
      target_id: item_id,
      requested_by_type: "public",
      requested_by_id: null,
    });

    const output = await runGenerateCommentsJob(env, {
      job_id: job.id,
      input,
      mode: "public",
    });

    const c = output.comments?.[0];
    if (!c || !c.text) {
      return Response.json(
        { ok: false, error: "NO_COMMENT_GENERATED", job_id: job.id },
        { status: 502 },
      );
    }

    // Save as user type (as requested)
    const saved = await insertItemComment(env, {
      item_id,
      text: c.text,
      translation_text: c.translation_text, // may be ""
      author_type: "user",
      author_id: null,
    });

    return Response.json({
      ok: true,
      job_id: job.id,
      comment: c,
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