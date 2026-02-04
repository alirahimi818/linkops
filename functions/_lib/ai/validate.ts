import type { DraftOutput, FinalOutput } from "./types";

/* ------------------------------ Utils ------------------------------ */

function normalizeHashtags(tags: string[]): string[] {
  return (tags || [])
    .map((t) => String(t).trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`));
}

function extractHashtagsFromText(text: string): string[] {
  const matches = String(text || "").match(/#[\p{L}\p{N}_]+/gu);
  return matches ? matches.map((m) => m.trim()) : [];
}

function extractMentionsFromText(text: string): string[] {
  const matches = String(text || "").match(/@[\p{L}\p{N}_]+/gu);
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

    if (depth === 0) return s.slice(start, i + 1);
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
  const trimmed = String(raw || "").trim();
  return safeJsonParse(trimmed);
}

function isSingleLine(s: string) {
  return !/[\r\n]/.test(String(s || ""));
}

function hasArabicScript(s: string) {
  // Arabic/Persian blocks (rough check)
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(String(s || ""));
}

function arraysEqualAsMultiset(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const map = new Map<string, number>();
  for (const x of a) map.set(x, (map.get(x) ?? 0) + 1);
  for (const y of b) {
    const v = map.get(y);
    if (!v) return false;
    if (v === 1) map.delete(y);
    else map.set(y, v - 1);
  }
  return map.size === 0;
}

/**
 * Check translation script:
 * - Persian is expected,
 * - BUT allow Latin inside hashtags and mentions only (must remain unchanged).
 */
function validatePersianScriptAllowingTagsAndMentions(translation: string, idx: number) {
  const t = String(translation || "");

  // Remove hashtags and mentions completely, then ensure remaining text
  // does NOT include Latin/Cyrillic/CJK letters.
  const stripped = t
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/@[\p{L}\p{N}_]+/gu, " ");

  if (/[A-Za-z]/.test(stripped)) throw new Error(`INVALID_TRANSLATION_SCRIPT_${idx}`);
  if (/[\u0400-\u04FF]/.test(stripped)) throw new Error(`INVALID_TRANSLATION_SCRIPT_${idx}`);
  if (/[\u4E00-\u9FFF]/.test(stripped)) throw new Error(`INVALID_TRANSLATION_SCRIPT_${idx}`);
}

function ensureSameMentionsAndHashtags(sourceText: string, translatedText: string, idx: number) {
  const srcTags = extractHashtagsFromText(sourceText);
  const trTags = extractHashtagsFromText(translatedText);

  const srcMentions = extractMentionsFromText(sourceText);
  const trMentions = extractMentionsFromText(translatedText);

  if (!arraysEqualAsMultiset(srcTags, trTags)) {
    throw new Error(`TRANSLATION_HASHTAGS_CHANGED_${idx}`);
  }
  if (!arraysEqualAsMultiset(srcMentions, trMentions)) {
    throw new Error(`TRANSLATION_MENTIONS_CHANGED_${idx}`);
  }
}

/* ------------------------------ Stage 1 ------------------------------ */
/**
 * Stage 1 output schema:
 * {"comments":[{"text":string}]}
 *
 * - English only (reject Arabic/Persian script)
 * - Each text single-line
 * - Hashtags in text must be from allowed whitelist
 * - No hashtags_used field
 */
export function validateDraftOutput(args: {
  raw: string;
  count: number;
  allowed_hashtags: string[];
}): DraftOutput {
  const allowed = new Set(normalizeHashtags(args.allowed_hashtags));
  const parsed = safeParseJson(args.raw);

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.comments)) {
    throw new Error("INVALID_JSON_SHAPE");
  }

  if (parsed.comments.length !== args.count) {
    throw new Error("INVALID_COMMENTS_COUNT");
  }

  const comments = parsed.comments.map((c: any, idx: number) => {
    const text = String(c?.text || "").trim();

    if (!text) throw new Error(`EMPTY_TEXT_${idx}`);
    if (!isSingleLine(text)) throw new Error("INVALID_LINEBREAKS");

    // Must be English: reject if Persian/Arabic appears
    if (hasArabicScript(text)) {
      throw new Error(`INVALID_TEXT_NOT_ENGLISH_${idx}`);
    }

    // Enforce hashtag whitelist based on text content
    const inText = extractHashtagsFromText(text);

    if (allowed.size === 0 && inText.length > 0) {
      throw new Error(`HASHTAGS_NOT_ALLOWED_${idx}`);
    }

    for (const h of inText) {
      if (!allowed.has(h)) {
        throw new Error(`ILLEGAL_HASHTAG_IN_TEXT_${idx}`);
      }
    }

    return { text };
  });

  return { comments };
}

/* ------------------------------ Stage 2 ------------------------------ */
/**
 * Stage 2 output schema:
 * {"comments":[{"text":string,"translation_text":string}]}
 *
 * Validation rules:
 * - comments length must match draft length
 * - text MUST equal draft.text exactly (no edits)
 * - translation_text MUST be Persian-ish (but allow hashtags/mentions)
 * - hashtags and mentions must remain exactly the same in translation
 *
 * NOTE:
 * - If translation fails, runner will store empty translation_text.
 * - This validator is for "successful translation" responses.
 */
export function validateTranslateOutput(args: {
  raw: string;
  draft: DraftOutput;
}): FinalOutput {
  const parsed = safeParseJson(args.raw);

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.comments)) {
    throw new Error("INVALID_JSON_SHAPE");
  }

  if (parsed.comments.length !== args.draft.comments.length) {
    throw new Error("INVALID_COMMENTS_COUNT");
  }

  const comments = parsed.comments.map((c: any, idx: number) => {
    const text = String(c?.text || "").trim();
    const translation_text = String(c?.translation_text || "").trim();

    const draftText = String(args.draft.comments[idx]?.text || "").trim();

    if (!text) throw new Error(`EMPTY_TEXT_${idx}`);
    if (!translation_text) throw new Error(`EMPTY_TRANSLATION_${idx}`);

    if (!isSingleLine(text) || !isSingleLine(translation_text)) {
      throw new Error("INVALID_LINEBREAKS");
    }

    if (text !== draftText) {
      throw new Error(`TEXT_CHANGED_FROM_DRAFT_${idx}`);
    }

    // Persian validation but allow hashtags/mentions to stay in Latin
    validatePersianScriptAllowingTagsAndMentions(translation_text, idx);

    // Mentions/hashtags must remain exactly the same
    ensureSameMentionsAndHashtags(draftText, translation_text, idx);

    return { text, translation_text };
  });

  return { comments };
}