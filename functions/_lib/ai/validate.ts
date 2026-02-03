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

function extractFirstJsonObject(raw: string): string | null {
  const s = String(raw || "");
  const start = s.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") depth--;

    if (depth === 0) {
      return s.slice(start, i + 1);
    }
  }

  return null;
}

function safeJsonParse(raw: string) {
  const trimmed = String(raw || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const extracted = extractFirstJsonObject(trimmed);
    if (!extracted) throw new Error("INVALID_JSON_OUTPUT");
    try {
      return JSON.parse(extracted);
    } catch {
      throw new Error("INVALID_JSON_OUTPUT");
    }
  }
}

function safeParseJson(raw: string): any {
  // Strip common wrappers just in case (but do not overdo it)
  const trimmed = String(raw || "").trim();
  return safeJsonParse(trimmed);
}

function isSingleLine(s: string) {
  return !/[\r\n]/.test(String(s || ""));
}

function hasNonPersianScripts(s: string) {
  const text = String(s || "");
  if (/[A-Za-z]/.test(text)) return true; // Latin
  if (/[\u0400-\u04FF]/.test(text)) return true; // Cyrillic
  if (/[\u4E00-\u9FFF]/.test(text)) return true; // CJK
  return false;
}

export function validateGenerateOutput(args: {
  raw: string;
  count: number;
  allowed_hashtags: string[];
}): GenerateOutput {
  const allowed = new Set(normalizeHashtags(args.allowed_hashtags));
  const parsed = safeParseJson(args.raw);

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray(parsed.comments)
  ) {
    throw new Error("INVALID_JSON_SHAPE");
  }

  if (parsed.comments.length !== args.count) {
    throw new Error("INVALID_COMMENTS_COUNT");
  }

  const comments: GeneratedComment[] = parsed.comments.map(
    (c: any, idx: number) => {
      const text = String(c?.text || "").trim();
      const translation_text = String(c?.translation_text || "").trim();
      const hashtags_used = Array.isArray(c?.hashtags_used)
        ? c.hashtags_used.map((x: any) => String(x).trim())
        : [];

      if (!text) throw new Error(`EMPTY_TEXT_${idx}`);
      if (!translation_text) throw new Error(`EMPTY_TRANSLATION_${idx}`);

      const normalizedUsed = normalizeHashtags(hashtags_used);

      if (!isSingleLine(c?.text) || !isSingleLine(c?.translation_text)) {
        throw new Error("INVALID_LINEBREAKS");
      }

      if (hasNonPersianScripts(c?.translation_text)) {
        throw new Error("INVALID_TRANSLATION_SCRIPT");
      }

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
    },
  );

  return { comments };
}
