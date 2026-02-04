import {
  createAIJob,
  runGenerateCommentsJob,
  insertItemComment,
} from "../../../_lib/ai/runner";
import type { GenerateInput, Tone } from "../../../_lib/ai/types";
import { requireAuth, requireRole } from "../_auth";

function clampInt(v: any, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

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
  // IMPORTANT: Adjust table/column names to your schema.
  // Assumption: table `allowed_hashtags` with `tag` column and `is_active=1`.
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

function normalizeExamples(bodyExamples: any): Array<{ text: string }> {
  const arr = Array.isArray(bodyExamples) ? bodyExamples : [];
  return arr
    .map((e: any) => ({ text: String(e?.text || "").trim() }))
    .filter((e) => e.text.length > 0)
    .slice(0, 10);
}

export async function onRequestPost(ctx: any): Promise<Response> {
  const { request, env } = ctx;

  try {
    // 1) Auth + role check
    const user = await requireAuth(env, request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!requireRole(user, ["superadmin", "admin", "editor"])) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminId = user.id;

    // 2) Parse payload
    const body = await request.json();

    const item_id = String(body.item_id || "").trim();
    const save = body.save === true;

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
      count: clampInt(body.count, 1, 30, 10),

      examples: normalizeExamples(body.examples),
    };

    // 3) Create job
    const job = await createAIJob(env, {
      job_type: "generate_item_comments_admin",
      target_type: "item",
      target_id: item_id,
      requested_by_type: "admin",
      requested_by_id: String(adminId),
    });

    // 4) Run job (admin mode)
    const output = await runGenerateCommentsJob(env, {
      job_id: job.id,
      input,
      mode: "admin",
    });

    // 5) Save comments to item_comments (append)
    const saved_ids: string[] = [];
    if (save) {
      for (const c of output.comments) {
        const saved = await insertItemComment(env, {
          item_id,
          text: c.text,
          translation_text: c.translation_text, // may be ""
          author_type: "ai",
          author_id: null,
        });
        saved_ids.push(saved.id);
      }
    }

    return Response.json({
      ok: true,
      job_id: job.id,
      saved_comment_ids: saved_ids,
      comments: output.comments,
    });
  } catch (e: any) {
    console.error("admin generate-comments failed:", e);

    return new Response(
      JSON.stringify({
        error: "INTERNAL_ERROR",
        message: e?.message ? String(e.message) : "unknown",
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}