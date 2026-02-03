import {
  createAIJob,
  getRandomItemCommentExamples,
  runGenerateCommentsJob,
  insertItemComment,
} from "../../_lib/ai/runner";
import type { GenerateInput } from "../../_lib/ai/types";

export async function onRequestPost(ctx: any): Promise<Response> {
  const { request, env } = ctx;
  const body = await request.json();

  const item_id = String(body.item_id || "");
  if (!item_id)
    return Response.json(
      { ok: false, error: "MISSING_ITEM_ID" },
      { status: 400 },
    );

  const examples = await getRandomItemCommentExamples(env, item_id, 5);

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
  const c = output.comments[0];

  // Save as user type (as you requested)
  const saved = await insertItemComment(env, {
    item_id,
    text: c.text,
    translation_text: c.translation_text,
    author_type: "user",
    author_id: null,
  });

  return Response.json({
    ok: true,
    job_id: job.id,
    comment: c,
    saved_comment_id: saved.id,
  });
}
