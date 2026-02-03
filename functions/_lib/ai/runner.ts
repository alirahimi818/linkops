import { getAIProvider } from "./provider";
import { buildGeneratePrompt } from "./prompts/generate_comments";
import { validateGenerateOutput } from "./validate";
import type { GenerateInput, GenerateOutput } from "./types";

export async function getRandomItemCommentExamples(env: Env, itemId: string, limit = 5) {
  const res = await env.DB.prepare(
    `SELECT text, translation_text
     FROM item_comments
     WHERE item_id = ?1
     ORDER BY RANDOM()
     LIMIT ?2`
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

export async function insertItemComment(env: Env, args: {
  item_id: string;
  text: string;
  translation_text?: string | null;
  author_type: "admin" | "ai" | "user";
  author_id?: string | null;
}) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO item_comments (id, item_id, text, translation_text, author_type, author_id, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  )
    .bind(id, args.item_id, args.text, args.translation_text ?? null, args.author_type, args.author_id ?? null, now)
    .run();

  return { id, created_at: now };
}

export async function createAIJob(env: Env, args: {
  job_type: string;
  target_type: string;
  target_id: string | null;
  requested_by_type: "admin" | "system" | "public";
  requested_by_id: string | null;
  temperature?: number | null;
  max_tokens?: number | null;
}) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO ai_jobs (
      id, job_type, target_type, target_id,
      status, requested_by_type, requested_by_id,
      provider, model, temperature, max_tokens,
      priority, created_at
    ) VALUES (?1, ?2, ?3, ?4, 'queued', ?5, ?6, NULL, NULL, ?7, ?8, 0, ?9)`
  )
    .bind(id, args.job_type, args.target_type, args.target_id, args.requested_by_type, args.requested_by_id,
      args.temperature ?? null, args.max_tokens ?? null, now)
    .run();

  return { id, created_at: now };
}

export async function addJobMessages(env: Env, jobId: string, messages: Array<{ role: string; content: string }>) {
  const now = new Date().toISOString();
  for (const m of messages) {
    await env.DB.prepare(
      "INSERT INTO ai_job_messages (id, job_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5)"
    )
      .bind(crypto.randomUUID(), jobId, m.role, m.content, now)
      .run();
  }
}

export async function runGenerateCommentsJob(env: Env, args: {
  job_id: string;
  input: GenerateInput;
  mode: "admin" | "public";
}): Promise<GenerateOutput> {
  // mark running
  await env.DB.prepare("UPDATE ai_jobs SET status='running', started_at=?1 WHERE id=?2")
    .bind(new Date().toISOString(), args.job_id)
    .run();

  try {
    const messages = buildGeneratePrompt(args.input);

    // store prompt messages
    await addJobMessages(env, args.job_id, messages);

    const provider = getAIProvider(env);
    const resp = await provider.chat({
      messages,
      temperature: undefined,
      max_tokens: undefined,
      mode: args.mode,
    });

    // store assistant raw output
    await env.DB.prepare(
      "INSERT INTO ai_job_messages (id, job_id, role, content, created_at) VALUES (?1, ?2, 'assistant', ?3, ?4)"
    )
      .bind(crypto.randomUUID(), args.job_id, resp.content, new Date().toISOString())
      .run();

    const output = validateGenerateOutput({
      raw: resp.content,
      count: args.input.count,
      allowed_hashtags: args.input.allowed_hashtags,
    });

    await env.DB.prepare("UPDATE ai_jobs SET status='done', finished_at=?1 WHERE id=?2")
      .bind(new Date().toISOString(), args.job_id)
      .run();

    return output;
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : "UNKNOWN_ERROR";
    await env.DB.prepare("UPDATE ai_jobs SET status='failed', error=?1, finished_at=?2 WHERE id=?3")
      .bind(msg, new Date().toISOString(), args.job_id)
      .run();
    throw new Error(msg);
  }
}
