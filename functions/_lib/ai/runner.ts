import { getAIProvider } from "./provider";
import type { DraftOutput, FinalOutput, GenerateInput } from "./types";
import { buildDraftPrompt, buildTranslatePrompt } from "./prompts/generate_comments";
import { validateDraftOutput, validateTranslateOutput } from "./validate";

export async function getRandomItemCommentExamples(
  env: Env,
  itemId: string,
  limit = 5,
) {
  const res = await env.DB.prepare(
    `SELECT text, translation_text
     FROM item_comments
     WHERE item_id = ?1
     ORDER BY RANDOM()
     LIMIT ?2`,
  )
    .bind(itemId, limit)
    .all<any>();

  return (res.results || [])
    .map((r) => ({
      text: String(r.text || "").trim(),
      translation_text: r.translation_text
        ? String(r.translation_text).trim()
        : undefined,
    }))
    .filter((e) => e.text.length > 0);
}

export async function insertItemComment(
  env: Env,
  args: {
    item_id: string;
    text: string;
    translation_text?: string | null;
    author_type: "admin" | "ai" | "user";
    author_id?: string | null;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO item_comments (id, item_id, text, translation_text, author_type, author_id, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  )
    .bind(
      id,
      args.item_id,
      args.text,
      args.translation_text ?? null,
      args.author_type,
      args.author_id ?? null,
      now,
    )
    .run();

  return { id, created_at: now };
}

export async function createAIJob(
  env: Env,
  args: {
    job_type: string;
    target_type: string;
    target_id: string | null;
    requested_by_type: "admin" | "system" | "public";
    requested_by_id: string | null;
    temperature?: number | null;
    max_tokens?: number | null;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO ai_jobs (
      id, job_type, target_type, target_id,
      status, requested_by_type, requested_by_id,
      provider, model, temperature, max_tokens,
      priority, created_at
    ) VALUES (?1, ?2, ?3, ?4, 'queued', ?5, ?6, NULL, NULL, ?7, ?8, 0, ?9)`,
  )
    .bind(
      id,
      args.job_type,
      args.target_type,
      args.target_id,
      args.requested_by_type,
      args.requested_by_id,
      args.temperature ?? null,
      args.max_tokens ?? null,
      now,
    )
    .run();

  return { id, created_at: now };
}

export async function addJobMessages(
  env: Env,
  jobId: string,
  messages: Array<{ role: string; content: string }>,
) {
  const now = new Date().toISOString();
  for (const m of messages) {
    await env.DB.prepare(
      "INSERT INTO ai_job_messages (id, job_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
    )
      .bind(crypto.randomUUID(), jobId, m.role, m.content, now)
      .run();
  }
}

export async function runGenerateCommentsJob(
  env: Env,
  args: {
    job_id: string;
    input: GenerateInput;
    mode: "admin" | "public";
  },
): Promise<FinalOutput> {
  await env.DB.prepare(
    "UPDATE ai_jobs SET status='running', started_at=?1 WHERE id=?2",
  )
    .bind(new Date().toISOString(), args.job_id)
    .run();

  const provider = getAIProvider(env);

  function shouldRetry(errMsg: string) {
    const m = String(errMsg || "");
    return (
      m.includes("INVALID_JSON_OUTPUT") ||
      m.includes("INVALID_JSON") ||
      m.includes("INVALID_JSON_SHAPE") ||
      m.includes("INVALID_LINEBREAKS") ||
      m.includes("INVALID_COMMENTS_COUNT") ||
      m.includes("Expected ',' or '}'") ||
      m.includes("Unterminated string in JSON") ||
      // Stage 1
      m.includes("ILLEGAL_HASHTAG_IN_TEXT") ||
      m.includes("HASHTAGS_NOT_ALLOWED") ||
      m.includes("INVALID_TEXT_NOT_ENGLISH") ||
      // Stage 2
      m.includes("INVALID_TRANSLATION_SCRIPT") ||
      m.includes("TRANSLATION_HASHTAGS_CHANGED") ||
      m.includes("TRANSLATION_MENTIONS_CHANGED") ||
      m.includes("TEXT_CHANGED_FROM_DRAFT")
    );
  }

  async function storeAssistant(content: string) {
    await env.DB.prepare(
      "INSERT INTO ai_job_messages (id, job_id, role, content, created_at) VALUES (?1, ?2, 'assistant', ?3, ?4)",
    )
      .bind(crypto.randomUUID(), args.job_id, content, new Date().toISOString())
      .run();
  }

  async function runChatOnce(messages: any[]) {
    const resp = await provider.chat({
      messages,
      temperature: args.mode === "admin" ? 0.6 : 0.7,
      max_tokens: args.mode === "admin" ? 2200 : 900,
      mode: args.mode,
    });

    await storeAssistant(resp.content);
    return resp.content;
  }

  async function runStageWithOneRetry<T>(params: {
    stageLabel: string;
    baseMessages: any[];
    retrySchemaNudge: string;
    validate: (raw: string) => T;
  }): Promise<T> {
    const { stageLabel, baseMessages, retrySchemaNudge, validate } = params;

    await addJobMessages(env, args.job_id, baseMessages);

    try {
      const raw1 = await runChatOnce(baseMessages);
      return validate(raw1);
    } catch (e1: any) {
      const msg1 = e1?.message ? String(e1.message) : "UNKNOWN_ERROR";
      if (!shouldRetry(msg1)) throw e1;

      await addJobMessages(env, args.job_id, [
        {
          role: "user",
          content: `[RETRY:${stageLabel}] previous output invalid. Forcing strict JSON only.`,
        },
      ]);

      const retryNudge = { role: "user", content: retrySchemaNudge };
      const retryMessages = [...baseMessages, retryNudge];

      const raw2 = await runChatOnce(retryMessages);
      return validate(raw2);
    }
  }

  try {
    /* ------------------------------ Stage 1: Draft (EN) ------------------------------ */
    const draftMessages = buildDraftPrompt(args.input);

    const draftRetryNudge =
      "Fix your output. Return ONLY valid JSON (no extra characters before/after). " +
      `Schema: {"comments":[{"text":string}]}. ` +
      `comments.length MUST equal ${args.input.count}. ` +
      "Each text must be English and single-line. " +
      "Hashtags, if used, must be ONLY from the allowed list. Do NOT invent hashtags. " +
      "No markdown, no code fences, no commentary.";

    const draft: DraftOutput = await runStageWithOneRetry<DraftOutput>({
      stageLabel: "DRAFT_EN",
      baseMessages: draftMessages,
      retrySchemaNudge: draftRetryNudge,
      validate: (raw) =>
        validateDraftOutput({
          raw,
          count: args.input.count,
          allowed_hashtags: args.input.allowed_hashtags,
        }),
    });

    /* ------------------------------ Stage 2: Translate (FA) ------------------------------ */
    const translateMessages = buildTranslatePrompt({
      draft,
      tone: args.input.tone,
      stream: args.input.stream,
      topic: args.input.topic,
    });

    const translateRetryNudge =
      "Fix your output. Return ONLY valid JSON (no extra characters before/after). " +
      `Schema: {"comments":[{"text":string,"translation_text":string}]}. ` +
      `comments.length MUST equal ${draft.comments.length}. ` +
      "text must be EXACTLY the same as the provided English text (no edits). " +
      "translation_text must be Persian. " +
      "IMPORTANT: Do NOT translate or change hashtags (#...) and mentions (@...). Keep them exactly unchanged. " +
      "All strings must be single-line. " +
      "No markdown, no code fences, no commentary.";

    let finalOut: FinalOutput;

    try {
      finalOut = await runStageWithOneRetry<FinalOutput>({
        stageLabel: "TRANSLATE_FA",
        baseMessages: translateMessages,
        retrySchemaNudge: translateRetryNudge,
        validate: (raw) =>
          validateTranslateOutput({
            raw,
            draft,
          }),
      });
    } catch (e2: any) {
      const msg2 = e2?.message ? String(e2.message) : "UNKNOWN_ERROR";
      if (!shouldRetry(msg2)) throw e2;

      finalOut = {
        comments: draft.comments.map((c) => ({
          text: c.text,
          translation_text: "",
        })),
      };
    }

    await env.DB.prepare(
      "UPDATE ai_jobs SET status='done', finished_at=?1 WHERE id=?2",
    )
      .bind(new Date().toISOString(), args.job_id)
      .run();

    return finalOut;
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : "UNKNOWN_ERROR";

    await env.DB.prepare(
      "UPDATE ai_jobs SET status='failed', error=?1, finished_at=?2 WHERE id=?3",
    )
      .bind(msg, new Date().toISOString(), args.job_id)
      .run();

    throw new Error(msg);
  }
}
