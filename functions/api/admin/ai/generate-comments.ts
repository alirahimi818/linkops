import {
  createAIJob,
  runGenerateCommentsJob,
  insertItemComment,
} from "../../../_lib/ai/runner";
import type { GenerateInput } from "../../../_lib/ai/types";

export async function onRequestPost(ctx: any): Promise<Response> {
  const { request, env } = ctx;

  // You likely already attach user in ctx.data via _auth middleware
  const adminId = ctx.data?.user?.id || null;
  if (!adminId)
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json();
  const item_id = String(body.item_id || "");
  if (!item_id)
    return Response.json(
      { ok: false, error: "MISSING_ITEM_ID" },
      { status: 400 },
    );

  const input: GenerateInput = {
    title_fa: String(body.title_fa || ""),
    description_fa: String(body.description_fa || ""),
    need_fa: String(body.need_fa || ""),
    comment_type_fa: String(body.comment_type_fa || "ریپلای کوتاه"),
    tone: body.tone || "neutral",

    stream: "political",
    topic: "iran_revolution_jan_2026",

    allowed_hashtags: Array.isArray(body.allowed_hashtags)
      ? body.allowed_hashtags
      : [],
    count: 10,

    // Admin can pass custom examples (optional)
    examples: Array.isArray(body.examples) ? body.examples : [],
  };

  const job = await createAIJob(env, {
    job_type: "generate_item_comments_admin",
    target_type: "item",
    target_id: item_id,
    requested_by_type: "admin",
    requested_by_id: String(adminId),
  });

  const output = await runGenerateCommentsJob(env, {
    job_id: job.id,
    input,
    mode: "admin",
  });

  // Save all generated comments to item_comments with author_type = 'ai'
  const saved_ids: string[] = [];
  for (const c of output.comments) {
    const saved = await insertItemComment(env, {
      item_id,
      text: c.text,
      translation_text: c.translation_text,
      author_type: "ai",
      author_id: null,
    });
    saved_ids.push(saved.id);
  }

  return Response.json({
    ok: true,
    job_id: job.id,
    saved_comment_ids: saved_ids,
    comments: output.comments,
  });
}
