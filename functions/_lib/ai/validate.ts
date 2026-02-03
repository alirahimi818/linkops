import type { GenerateOutput, GeneratedComment } from "./types";

function normalizeHashtags(tags: string[]): string[] {
  return (tags || [])
    .map((t) => String(t).trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`));
}

function extractHashtagsFromText(text: string): string[] {
  // Basic hashtag extraction
  const matches = text.match(/#[\p{L}\p{N}_]+/gu);
  return matches ? matches.map((m) => m.trim()) : [];
}

function safeParseJson(raw: string): any {
  // Strip common wrappers just in case (but do not overdo it)
  const trimmed = String(raw || "").trim();
  return JSON.parse(trimmed);
}

export function validateGenerateOutput(args: {
  raw: string;
  count: number;
  allowed_hashtags: string[];
}): GenerateOutput {
  const allowed = new Set(normalizeHashtags(args.allowed_hashtags));
  const parsed = safeParseJson(args.raw);

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.comments)) {
    throw new Error("INVALID_JSON_SHAPE");
  }

  if (parsed.comments.length !== args.count) {
    throw new Error("INVALID_COMMENTS_COUNT");
  }

  const comments: GeneratedComment[] = parsed.comments.map((c: any, idx: number) => {
    const text = String(c?.text || "").trim();
    const translation_text = String(c?.translation_text || "").trim();
    const hashtags_used = Array.isArray(c?.hashtags_used) ? c.hashtags_used.map((x: any) => String(x).trim()) : [];

    if (!text) throw new Error(`EMPTY_TEXT_${idx}`);
    if (!translation_text) throw new Error(`EMPTY_TRANSLATION_${idx}`);

    const normalizedUsed = normalizeHashtags(hashtags_used);

    // If allowed is empty, used must be empty
    if (allowed.size === 0 && normalizedUsed.length > 0) {
      throw new Error(`HASHTAGS_NOT_ALLOWED_${idx}`);
    }

    // used must be subset of allowed
    for (const h of normalizedUsed) {
      if (!allowed.has(h)) throw new Error(`ILLEGAL_HASHTAG_USED_${idx}`);
    }

    // text must not contain any hashtag outside hashtags_used
    const inText = extractHashtagsFromText(text);
    const usedSet = new Set(normalizedUsed);
    for (const h of inText) {
      if (!usedSet.has(h)) {
        throw new Error(`ILLEGAL_HASHTAG_IN_TEXT_${idx}`);
      }
      if (allowed.size > 0 && !allowed.has(h)) {
        throw new Error(`ILLEGAL_HASHTAG_IN_TEXT_${idx}`);
      }
    }

    return { text, translation_text, hashtags_used: normalizedUsed };
  });

  return { comments };
}
