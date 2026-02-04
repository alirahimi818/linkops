import { getAIProvider } from "./provider";
import type { DraftOutput, FinalOutput, GenerateInput } from "./types";

// New separated prompt files:
import { buildDraftPrompt } from "./prompts/draft_en";
import { buildTranslateToFaTextPrompt } from "./prompts/translate_to_fa_text";

import { validateDraftOutput, validateTranslationText } from "./validate";

/* ------------------------------ DB helpers ------------------------------ */

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

/* ------------------------------ Runner ------------------------------ */

export async function runGenerateCommentsJob(
  env: Env,
  args: {
    job_id: string;
    input: GenerateInput;
    mode: "admin" | "public";
  },
): Promise<FinalOutput> {
  const provider = getAIProvider(env);

  // Stage1 quality knobs
  // - Admin: slightly lower temp for better "style lock"
  // - Public: keep it a bit higher
  const temperature = args.mode === "admin" ? 0.55 : 0.7;

  // Stage1 token budget
  const max_tokens_stage1 = args.mode === "admin" ? 2400 : 900;

  // Stage2 token budget (single short line)
  const max_tokens_stage2 = 220;

  // Single update: mark running + store provider/model/config
  await env.DB.prepare(
    "UPDATE ai_jobs SET status='running', started_at=?1, provider=?2, model=?3, temperature=?4, max_tokens=?5 WHERE id=?6",
  )
    .bind(
      new Date().toISOString(),
      provider.name,
      (provider as any).model ?? null,
      temperature,
      max_tokens_stage1,
      args.job_id,
    )
    .run();

  function shouldRetry(errMsg: string) {
    const m = String(errMsg || "");

    // We only retry once, so keep this permissive.
    return (
      m.includes("INVALID_JSON_OUTPUT") ||
      m.includes("INVALID_JSON") ||
      m.includes("INVALID_JSON_SHAPE") ||
      m.includes("INVALID_COMMENTS_COUNT") ||
      m.includes("INVALID_LINEBREAKS") ||
      m.includes("INVALID_TEXT_NOT_ENGLISH") ||
      m.includes("ILLEGAL_HASHTAG_IN_TEXT") ||
      m.includes("HASHTAGS_NOT_ALLOWED") ||
      m.includes("Expected ',' or '}'") ||
      m.includes("Unterminated string") ||
      // Translation validator errors:
      m.includes("INVALID_TRANSLATION_SCRIPT") ||
      m.includes("TRANSLATION_HASHTAGS_CHANGED") ||
      m.includes("TRANSLATION_MENTIONS_CHANGED") ||
      m.includes("INVALID_TRANSLATION_WRAPPED") ||
      m.includes("EMPTY_TRANSLATION")
    );
  }

  async function storeAssistant(content: string) {
    await env.DB.prepare(
      "INSERT INTO ai_job_messages (id, job_id, role, content, created_at) VALUES (?1, ?2, 'assistant', ?3, ?4)",
    )
      .bind(crypto.randomUUID(), args.job_id, content, new Date().toISOString())
      .run();
  }

  async function runChatOnce(params: {
    messages: any[];
    max_tokens: number;
  }) {
    const resp = await provider.chat({
      messages: params.messages,
      temperature,
      max_tokens: params.max_tokens,
      mode: args.mode,
    });

    await storeAssistant(resp.content);
    return resp.content;
  }

  async function runStageJsonWithOneRetry<T>(params: {
    stageLabel: string;
    baseMessages: any[];
    retryNudge: string;
    validate: (raw: string) => T;
    max_tokens: number;
  }): Promise<T> {
    const { stageLabel, baseMessages, retryNudge, validate, max_tokens } =
      params;

    await addJobMessages(env, args.job_id, baseMessages);

    try {
      const raw1 = await runChatOnce({ messages: baseMessages, max_tokens });
      return validate(raw1);
    } catch (e1: any) {
      const msg1 = e1?.message ? String(e1.message) : "UNKNOWN_ERROR";
      if (!shouldRetry(msg1)) throw e1;

      await addJobMessages(env, args.job_id, [
        {
          role: "user",
          content: `[RETRY:${stageLabel}] previous output invalid. Return strict output only.`,
        },
      ]);

      const retryMessages = [
        ...baseMessages,
        { role: "user", content: retryNudge },
      ];

      const raw2 = await runChatOnce({ messages: retryMessages, max_tokens });
      return validate(raw2);
    }
  }

  async function runTranslateTextWithOneRetry(params: {
    stageLabel: string;
    baseMessages: any[];
    retryNudge: string;
    validate: (rawText: string) => string; // returns cleaned translation text
  }): Promise<string> {
    const { stageLabel, baseMessages, retryNudge, validate } = params;

    await addJobMessages(env, args.job_id, baseMessages);

    try {
      const raw1 = await runChatOnce({
        messages: baseMessages,
        max_tokens: max_tokens_stage2,
      });
      return validate(raw1);
    } catch (e1: any) {
      const msg1 = e1?.message ? String(e1.message) : "UNKNOWN_ERROR";
      if (!shouldRetry(msg1)) throw e1;

      await addJobMessages(env, args.job_id, [
        {
          role: "user",
          content: `[RETRY:${stageLabel}] previous output invalid. Return ONLY the Persian translation text.`,
        },
      ]);

      const retryMessages = [
        ...baseMessages,
        { role: "user", content: retryNudge },
      ];

      const raw2 = await runChatOnce({
        messages: retryMessages,
        max_tokens: max_tokens_stage2,
      });

      return validate(raw2);
    }
  }

  try {
    /* ------------------------------ Stage 1: Draft (EN JSON) ------------------------------ */

    const draftMessages = buildDraftPrompt(args.input);

    const draftRetryNudge =
      "Fix your output. Return ONLY valid JSON (no extra characters before/after). " +
      `Schema: {"comments":[{"text":string}]}. ` +
      "Top-level JSON must contain ONLY the key 'comments'. " +
      "Do NOT include wrapper keys like 'response', 'usage', 'tool_calls'. " +
      `comments.length MUST equal ${args.input.count}. ` +
      "Each text must be English and single-line. " +
      "Match the examples' style: strong, specific, activist tone; not generic. " +
      "Use @mentions and whitelisted hashtags naturally when appropriate. " +
      "Respect hashtag rules strictly. " +
      "No markdown, no code fences, no commentary.";

    const draft: DraftOutput = await runStageJsonWithOneRetry<DraftOutput>({
      stageLabel: "DRAFT_EN",
      baseMessages: draftMessages,
      retryNudge: draftRetryNudge,
      max_tokens: max_tokens_stage1,
      validate: (raw) =>
        validateDraftOutput({
          raw,
          count: args.input.count,
          allowed_hashtags: args.input.allowed_hashtags,
        }),
    });

    /* ------------------------------ Stage 2: Translate (FA TEXT, per item) ------------------------------ */

    const finalComments: Array<{ text: string; translation_text: string }> = [];

    for (let i = 0; i < draft.comments.length; i++) {
      const text_en = String(draft.comments[i]?.text ?? "").trim();

      const translateMessages = buildTranslateToFaTextPrompt({
        text_en,
        tone: args.input.tone,
        stream: args.input.stream,
        topic: args.input.topic,
      });

      const translateRetryNudge =
        "Return ONLY the Persian translation text as a SINGLE LINE. " +
        "Do NOT return JSON. Do NOT add quotes. Do NOT add extra text. " +
        "Do NOT translate or change hashtags (#...) and mentions (@...). Keep them exactly unchanged.";

      let translation_text = "";

      try {
        translation_text = await runTranslateTextWithOneRetry({
          stageLabel: `TRANSLATE_FA_${i + 1}`,
          baseMessages: translateMessages,
          retryNudge: translateRetryNudge,
          validate: (rawText) =>
            validateTranslationText({
              raw: rawText,
              source_text: text_en,
              idx: i,
            }),
        });
      } catch (e: any) {
        const msg = e?.message ? String(e.message) : "UNKNOWN_ERROR";
        if (!shouldRetry(msg)) throw e;
        translation_text = "";
      }

      finalComments.push({ text: text_en, translation_text });
    }

    const finalOut: FinalOutput = { comments: finalComments };

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