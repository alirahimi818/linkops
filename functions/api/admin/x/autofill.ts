import { createAIJob, runGenerateCommentsJob } from "../../../_lib/ai/runner";
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
    const x_url = String(body.x_url || "").trim();
    if (!x_url) {
      return Response.json({ ok: false, error: "MISSING_X_URL" }, { status: 400 });
    }

    const allowed_hashtags = await getAllowedHashtagsFromDb(env);

    // IMPORTANT:
    // This assumes you've added support for `x_url` in GenerateInput + runner logic.
    // If you haven't yet, do that first (I'll show you in the next step if needed).
    const input: GenerateInput = {
      x_url,

      // Keep these for backward compatibility; runner will override them internally when x_url exists.
      title_fa: "",
      description_fa: "",
      need_fa: "",
      comment_type_fa: String(body.comment_type_fa || "ریپلای کوتاه").trim(),

      tone: normalizeTone(body.tone),
      stream: "political",
      topic: "iran_revolution_jan_2026",

      allowed_hashtags,
      count: clampInt(body.count, 1, 30, 10),
      examples: [],
    };

    // 3) Create job (separate job type)
    const job = await createAIJob(env, {
      job_type: "admin_x_autofill",
      target_type: "x_url",
      target_id: null,
      requested_by_type: "admin",
      requested_by_id: String(adminId),
    });

    // 4) Run job (admin mode)
    const output = await runGenerateCommentsJob(env, {
      job_id: job.id,
      input,
      mode: "admin",
    });

    // 5) Return payload for filling the form
    // Title/description can be computed in runner and returned, or you can keep it simple:
    // For now: let frontend keep title/description as-is (or we enhance runner to return them)
    return Response.json({
      ok: true,
      job_id: job.id,
      title: "",        // we will fill this after we add Stage0 extraction output
      description: "",  // we will fill this after we add Stage0 extraction output
      comments: output.comments,
    });
  } catch (e: any) {
    console.error("admin x autofill failed:", e);

    return new Response(
      JSON.stringify({
        error: "INTERNAL_ERROR",
        message: e?.message ? String(e.message) : "unknown",
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
