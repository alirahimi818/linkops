import {
  createAIJob,
  runGenerateCommentsJob,
  insertItemComment,
} from "../../../_lib/ai/runner";
import type { GenerateInput } from "../../../_lib/ai/types";
import { requireAuth, requireRole } from "../_auth";

export async function onRequestPost(ctx: any): Promise<Response> {
  const { request, env } = ctx;

  // 1) Auth + role check (based on your _auth.ts)
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
  const item_id = String(body.item_id || "");
  const save = body.save === true;
  if (!item_id) {
    return Response.json({ ok: false, error: "MISSING_ITEM_ID" }, { status: 400 });
  }

  // Basic required fields (optional but recommended)
  const title_fa = String(body.title_fa || "").trim();
  const description_fa = String(body.description_fa || "").trim();
  const need_fa = String(body.need_fa || "").trim();

  if (!title_fa || !description_fa || !need_fa) {
    return Response.json(
      { ok: false, error: "MISSING_REQUIRED_FIELDS" },
      { status: 400 },
    );
  }

  const input: GenerateInput = {
    title_fa,
    description_fa,
    need_fa,
    comment_type_fa: String(body.comment_type_fa || "ریپلای کوتاه"),
    tone: body.tone || "neutral",

    stream: "political",
    topic: "iran_revolution_jan_2026",

    allowed_hashtags: Array.isArray(body.allowed_hashtags) ? body.allowed_hashtags : [],
    count: 10,

    examples: Array.isArray(body.examples) ? body.examples : [],
  };

  // 3) Create job
  const job = await createAIJob(env, {
    job_type: "generate_item_comments_admin",
    target_type: "item",
    target_id: item_id,
    requested_by_type: "admin",
    requested_by_id: String(adminId),
  });

  // 4) Run job (admin model)
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
      translation_text: c.translation_text,
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
}