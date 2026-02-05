import { getAIProvider } from "./provider";
import type { DraftOutput, FinalOutput, GenerateInput } from "./types";

// Prompts
import { buildDraftPrompt } from "./prompts/draft_en";
import { buildTranslateToFaTextPrompt } from "./prompts/translate_to_fa_text";

// Validators
import {
  validateDraftOutput,
  validateTranslationBatchOutput,
} from "./validate";

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
  const temperature = args.mode === "admin" ? 0.55 : 0.7;

  // Stage1 token budget
  const max_tokens_stage1 = args.mode === "admin" ? 2400 : 900;

  // Stage2 token budget (batch)
  const max_tokens_stage2 = Math.max(650, 140 * args.input.count);

  // Mark job running + store provider/model/config
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
      // Batch translation errors:
      m.includes("INVALID_TRANSLATION_JSON_SHAPE") ||
      m.includes("INVALID_TRANSLATION_COUNT")
    );
  }

  async function storeAssistant(content: string) {
    await env.DB.prepare(
      "INSERT INTO ai_job_messages (id, job_id, role, content, created_at) VALUES (?1, ?2, 'assistant', ?3, ?4)",
    )
      .bind(crypto.randomUUID(), args.job_id, content, new Date().toISOString())
      .run();
  }

  async function runChatOnce(params: { messages: any[]; max_tokens: number }) {
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
      "Match the examples' style: strong, specific; not generic. " +
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

    /* ------------------------------ Stage 2: Translate (FA JSON, batch) ------------------------------ */

    const sources_en = draft.comments.map((c) => String(c?.text ?? "").trim());

    const translateMessages = buildTranslateToFaTextPrompt({
      texts_en: sources_en,
      tone: args.input.tone,
      stream: args.input.stream,
      topic: args.input.topic,
    } as any);

    const translateRetryNudge =
      "Fix your output. Return ONLY valid JSON exactly: {\"translations\":[{\"text\":string}]}. " +
      `translations.length MUST equal ${sources_en.length}. ` +
      "Top-level JSON must contain ONLY the key 'translations'. " +
      "Each translation must be a SINGLE LINE in Persian. " +
      "Keep hashtags (#...) and mentions (@...) EXACTLY unchanged. " +
      "Do NOT output any Chinese/Japanese/Korean characters. " +
      "If unsure for an item, output an empty string for that item. " +
      "No markdown, no extra text.";

    const translations: string[] = await runStageJsonWithOneRetry<string[]>({
      stageLabel: "TRANSLATE_FA_BATCH",
      baseMessages: translateMessages,
      retryNudge: translateRetryNudge,
      max_tokens: max_tokens_stage2,
      validate: (raw) =>
        validateTranslationBatchOutput({
          raw,
          sources_en,
        }),
    });

    /* ------------------------------ Final output ------------------------------ */

    const finalComments: Array<{ text: string; translation_text: string }> = [];
    for (let i = 0; i < sources_en.length; i++) {
      finalComments.push({
        text: sources_en[i],
        translation_text: translations[i] ?? "",
      });
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