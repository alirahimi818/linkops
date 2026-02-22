import { getAIProvider } from "./provider";
import type { DraftOutput, FinalOutput, GenerateInput } from "./types";

// Prompts
import { buildDraftPrompt } from "./prompts/draft_en";
import { buildTranslateToFaTextPrompt } from "./prompts/translate_to_fa_text";
import { buildFetchXContextPrompt } from "./prompts/fetch_x_context";
import { buildFetchXAutofillAndDraftEnPrompt } from "./prompts/fetch_x_autofill_en";

// Validators
import {
  validateAutofillDraftWithMeta,
  validateDraftOutput,
  validateTranslationBatchOutput,
} from "./validate";

import { fixFaTypography } from "../../utils/fix_fa_typography";

/* ------------------------------ DB helpers ------------------------------ */

export async function getRandomItemCommentExamples(env: Env, itemId: string, limit = 5) {
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
      translation_text: r.translation_text ? String(r.translation_text).trim() : undefined,
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
    .bind(id, args.item_id, args.text, args.translation_text ?? null, args.author_type, args.author_id ?? null, now)
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

type XContext = { post_text: string; reply_texts: string[] };

function parseXContext(raw: string): XContext {
  const t = String(raw || "").trim();
  let obj: any = null;

  try {
    obj = JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) obj = JSON.parse(t.slice(start, end + 1));
    else throw new Error("INVALID_X_CONTEXT_JSON");
  }

  if (!obj || typeof obj !== "object") throw new Error("INVALID_X_CONTEXT_SHAPE");

  const post_text = String(obj.post_text || "").trim();
  const reply_texts = Array.isArray(obj.reply_texts)
    ? obj.reply_texts
        .map((x: any) => String(x || "").replace(/[\r\n]/g, " ").trim())
        .filter(Boolean)
    : [];

  return { post_text, reply_texts };
}

function buildAutofillMeta(x_url: string, ctx: XContext) {
  const post = String(ctx.post_text || "").replace(/\s+/g, " ").trim();
  const replies = Array.isArray(ctx.reply_texts) ? ctx.reply_texts : [];

  const title = post ? post.slice(0, 120) : "پست X";
  const description = [
    post ? `متن پست:\n${post}` : "",
    replies.length ? `\n\nنمونه ریپلای‌ها:\n- ${replies.slice(0, 8).join("\n- ")}` : "",
  ]
    .join("")
    .trim()
    .slice(0, 2000);

  return {
    title,
    description,
    source: {
      x_url,
      post_text: post,
      reply_texts: replies.slice(0, 12),
    },
  };
}

export async function runGenerateCommentsJob(
  env: Env,
  args: {
    job_id: string;
    input: GenerateInput;
    mode: "admin" | "public";
  },
): Promise<FinalOutput> {
  const provider = getAIProvider(env);

  const temperature = args.mode === "admin" ? 0.55 : 0.7;
  const max_tokens_stage1 = args.mode === "admin" ? 2200 : 900;

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
    const m = String(errMsg || "").toLowerCase();

    // Keep this minimal to avoid wasting calls
    return (
      m.includes("no_usable_draft_lines") ||
      m.includes("invalid_translation_json_shape") ||
      m.includes("invalid_json_output") ||
      m.includes("timeout") ||
      m.includes("rate") ||
      m.includes("temporar") ||
      m.includes("xai_http_") ||
      m.includes("tool") ||
      m.includes("autofill_missing_separator")
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
    tools?: any[];
    tool_choice?: any;
  }) {
    const resp = await provider.chat({
      messages: params.messages,
      temperature,
      max_tokens: params.max_tokens,
      mode: args.mode,
      tools: params.tools,
      tool_choice: params.tool_choice,
    });

    await storeAssistant(resp.content);
    return resp.content;
  }

  async function runStageWithOneRetry<T>(params: {
    stageLabel: string;
    baseMessages: any[];
    retryNudge: string;
    validate: (raw: string) => T;
    max_tokens: number;
    tools?: any[];
    tool_choice?: any;
  }): Promise<T> {
    const { stageLabel, baseMessages, retryNudge, validate, max_tokens, tools, tool_choice } = params;

    await addJobMessages(env, args.job_id, baseMessages);

    try {
      const raw1 = await runChatOnce({ messages: baseMessages, max_tokens, tools, tool_choice });
      return validate(raw1);
    } catch (e1: any) {
      const msg1 = e1?.message ? String(e1.message) : "UNKNOWN_ERROR";
      if (!shouldRetry(msg1)) throw e1;

      await addJobMessages(env, args.job_id, [
        { role: "user", content: `[RETRY:${stageLabel}] previous output invalid. Return corrected output only.` },
      ]);

      const retryMessages = [...baseMessages, { role: "user", content: retryNudge }];
      const raw2 = await runChatOnce({ messages: retryMessages, max_tokens, tools, tool_choice });
      return validate(raw2);
    }
  }

  try {
    let effectiveInput: GenerateInput = args.input;
    let meta: FinalOutput["meta"] | undefined = undefined;
    let draft: DraftOutput | null = null;

    /* ------------------------------ Stage 0: X URL paths ------------------------------ */
    if (args.input.x_url && args.input.x_url.trim()) {
      if (provider.name !== "xai") throw new Error("X_URL_REQUIRES_XAI_PROVIDER");

      const x_url = args.input.x_url.trim();

      // ✅ Admin autofill path: one call for FA meta + EN draft using x_search
      if (args.mode === "admin") {
        const messages = buildFetchXAutofillAndDraftEnPrompt({
          x_url,
          count: effectiveInput.count,
          allowed_hashtags: effectiveInput.allowed_hashtags,
          tone: effectiveInput.tone,
        });

        const retryNudge = [
          "Your previous output was invalid.",
          "Return PLAIN TEXT ONLY (no JSON, no markdown, no numbering).",
          "Use the exact format:",
          "TITLE_FA: <short Persian title>",
          "DESC_FA: <line 1>",
          "DESC_FA: <line 2>",
          "DESC_FA: <line 3 (optional)>",
          "---",
          "then English comments, one per line.",
        ].join("\n");

        const parsed = await runStageWithOneRetry<{
          meta: { title: string; description: string };
          draft: DraftOutput;
        }>({
          stageLabel: "FETCH_X_AUTOFILL_DRAFT_EN",
          baseMessages: messages,
          retryNudge,
          max_tokens: 2400,
          tools: [{ type: "x_search" }],
          tool_choice: "auto",
          validate: (raw) =>
            validateAutofillDraftWithMeta({
              raw,
              count: effectiveInput.count,
              allowed_hashtags: effectiveInput.allowed_hashtags,
            }),
        });

        meta = {
          title: fixFaTypography(parsed.meta.title ?? ""),
          description: fixFaTypography(parsed.meta.description ?? ""),
          source: { x_url },
        };

        draft = parsed.draft;
      } else {
        // ✅ Public/legacy path: keep JSON fetch + draft prompt
        const xMessages = buildFetchXContextPrompt({ x_url });

        const xContext = await runStageWithOneRetry<XContext>({
          stageLabel: "FETCH_X_CONTEXT",
          baseMessages: xMessages,
          retryNudge:
            'Return ONLY valid JSON exactly: {"post_text":string,"reply_texts":string[]}. No extra keys.',
          max_tokens: 1200,
          validate: (raw) => parseXContext(raw),
          tools: [{ type: "x_search" }],
          tool_choice: "auto",
        });

        meta = buildAutofillMeta(x_url, xContext);

        const repliesBlock =
          xContext.reply_texts.length > 0
            ? `\n\nنمونه‌ای از ریپلای‌های واقعی:\n- ${xContext.reply_texts.slice(0, 8).join("\n- ")}`
            : "";

        effectiveInput = {
          ...args.input,
          title_fa: "متن پست X:",
          description_fa: (String(xContext.post_text || "") + repliesBlock).trim(),
          need_fa: "چند ریپلای کوتاه و واقعی برای این پست بنویس (متناسب با لحن انتخاب‌شده).",
          comment_type_fa: args.input.comment_type_fa || "ریپلای کوتاه",
        };
      }
    }

    /* ------------------------------ Stage 1: Draft (EN, lenient) ------------------------------ */
    if (!draft) {
      const draftMessages = buildDraftPrompt(effectiveInput);

      const draftRetryNudge = [
        "Your previous output was not usable.",
        "Return plain text ONLY.",
        "One comment per line.",
        "No numbering, no bullets, no JSON, no markdown.",
        "Write at least 5 lines if possible.",
      ].join("\n");

      draft = await runStageWithOneRetry<DraftOutput>({
        stageLabel: "DRAFT_EN",
        baseMessages: draftMessages,
        retryNudge: draftRetryNudge,
        max_tokens: max_tokens_stage1,
        validate: (raw) =>
          validateDraftOutput({
            raw,
            count: effectiveInput.count,
            allowed_hashtags: effectiveInput.allowed_hashtags,
          }),
      });
    }

    const sources_en = (draft?.comments || [])
      .map((c) => String(c?.text ?? "").trim())
      .filter(Boolean);

    if (sources_en.length === 0) throw new Error("NO_USABLE_DRAFT_LINES");

    /* ------------------------------ Stage 2: Translate (FA JSON, batch) ------------------------------ */
    const max_tokens_stage2 = Math.max(450, 120 * sources_en.length);

    const translateMessages = buildTranslateToFaTextPrompt({
      texts_en: sources_en,
      tone: effectiveInput.tone,
      stream: effectiveInput.stream,
      topic: effectiveInput.topic,
    } as any);

    const translateRetryNudge = [
      'Return ONLY valid JSON: {"translations":[{"text":string}]}.',
      `translations.length must equal ${sources_en.length}.`,
      "Each item must be a SINGLE LINE Persian translation.",
      "Keep hashtags and mentions EXACTLY unchanged.",
      "If unsure, output empty string for that item.",
      "No markdown, no extra text.",
    ].join("\n");

    const translations = await runStageWithOneRetry<string[]>({
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

    const finalOut: FinalOutput = {
      comments: finalComments,
      meta: meta
        ? {
            ...meta,
            title: meta.title ?? "",
            description: meta.description ?? "",
          }
        : undefined,
    };

    await env.DB.prepare("UPDATE ai_jobs SET status='done', finished_at=?1 WHERE id=?2")
      .bind(new Date().toISOString(), args.job_id)
      .run();

    return finalOut;
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : "UNKNOWN_ERROR";

    await env.DB.prepare("UPDATE ai_jobs SET status='failed', error=?1, finished_at=?2 WHERE id=?3")
      .bind(msg, new Date().toISOString(), args.job_id)
      .run();

    throw new Error(msg);
  }
}