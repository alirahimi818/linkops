import type { DraftOutput } from "./types";

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
  // Mentions should usually be Latin/underscore; allow unicode word chars too (safe)
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
function validatePersianScriptAllowingTagsAndMentions(
  translation: string,
  idxLabel: string,
) {
  const t = String(translation || "");

  // Remove hashtags and mentions, then forbid Latin/Cyrillic/CJK in the rest
  const stripped = t
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/@[\p{L}\p{N}_]+/gu, " ");

  if (/[A-Za-z]/.test(stripped)) throw new Error(`INVALID_TRANSLATION_SCRIPT_${idxLabel}`);
  if (/[\u0400-\u04FF]/.test(stripped)) throw new Error(`INVALID_TRANSLATION_SCRIPT_${idxLabel}`);
  if (/[\u4E00-\u9FFF]/.test(stripped)) throw new Error(`INVALID_TRANSLATION_SCRIPT_${idxLabel}`);
}

function ensureSameMentionsAndHashtags(
  sourceText: string,
  translatedText: string,
  idxLabel: string,
) {
  const srcTags = extractHashtagsFromText(sourceText);
  const trTags = extractHashtagsFromText(translatedText);

  const srcMentions = extractMentionsFromText(sourceText);
  const trMentions = extractMentionsFromText(translatedText);

  if (!arraysEqualAsMultiset(srcTags, trTags)) {
    throw new Error(`TRANSLATION_HASHTAGS_CHANGED_${idxLabel}`);
  }
  if (!arraysEqualAsMultiset(srcMentions, trMentions)) {
    throw new Error(`TRANSLATION_MENTIONS_CHANGED_${idxLabel}`);
  }
}

/**
 * Heuristic guard: prevent returning JSON / markdown / wrapper text.
 * We want ONLY Persian text in stage2.
 */
function looksLikeJsonOrWrappedOutput(s: string) {
  const t = String(s || "").trim();
  if (!t) return false;
  if (t.startsWith("{") || t.startsWith("[")) return true;
  if (t.startsWith("```") || t.includes("```")) return true;
  if (/^\s*("?response"?\s*:)/i.test(t)) return true;
  if (/^output\s*:/i.test(t)) return true;
  if (/^translation\s*:/i.test(t)) return true;
  return false;
}

function normalizeTranslationText(raw: string) {
  // Important: Do NOT change hashtags/mentions tokens.
  // Only trim and collapse whitespace.
  return String(raw || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/* ------------------------------ Stage 1 ------------------------------ */
/**
 * Stage 1 output schema:
 * {"comments":[{"text":string}]}
 *
 * - English only (reject Arabic/Persian script)
 * - Each text single-line
 * - Hashtags in text must be from allowed whitelist
 * - comments.length MUST equal count
 */
export function validateDraftOutput(args: {
  raw: string;
  count: number;
  allowed_hashtags: string[];
}): DraftOutput {
  const allowed = new Set(normalizeHashtags(args.allowed_hashtags));
  const parsed = safeParseJson(args.raw);

  const root =
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as any).comments)
      ? (parsed as any)
      : parsed &&
          typeof parsed === "object" &&
          (parsed as any).response &&
          typeof (parsed as any).response === "object" &&
          Array.isArray((parsed as any).response.comments)
        ? (parsed as any).response
        : null;

  if (!root) throw new Error("INVALID_JSON_SHAPE");

  if (root.comments.length !== args.count) {
    throw new Error("INVALID_COMMENTS_COUNT");
  }

  const comments = root.comments.map((c: any, idx: number) => {
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

/* ------------------------------ Stage 2 (text only) ------------------------------ */
/**
 * Stage 2 output is PLAIN TEXT ONLY (Persian single-line).
 *
 * The runner already has the source English text.
 * We validate:
 * - non-empty
 * - single-line
 * - not JSON/wrapper
 * - Persian-ish script (allow Latin inside hashtags/mentions)
 * - mentions/hashtags unchanged (multiset)
 *
 * Returns: normalized translation text string.
 */
export function validateTranslationText(args: {
  raw: string;
  source_text: string;
  idx?: number;
}): string {
  const idxLabel = typeof args.idx === "number" ? String(args.idx) : "X";

  if (looksLikeJsonOrWrappedOutput(args.raw)) {
    throw new Error(`INVALID_TRANSLATION_WRAPPED_${idxLabel}`);
  }

  const translation = normalizeTranslationText(args.raw);
  if (!translation) throw new Error(`EMPTY_TRANSLATION_${idxLabel}`);

  if (!isSingleLine(translation)) {
    throw new Error(`INVALID_LINEBREAKS_${idxLabel}`);
  }

  // Ensure Persian-ish (heuristic): at least one Arabic-script char somewhere
  // (excluding just hashtags/mentions)
  const stripped = translation
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/@[\p{L}\p{N}_]+/gu, " ")
    .trim();

  if (stripped && !hasArabicScript(stripped)) {
    // If user wrote a fully Latin translation, fail.
    throw new Error(`INVALID_TRANSLATION_SCRIPT_${idxLabel}`);
  }

  validatePersianScriptAllowingTagsAndMentions(translation, idxLabel);
  ensureSameMentionsAndHashtags(args.source_text, translation, idxLabel);

  return translation;
}