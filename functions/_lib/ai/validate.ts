import type { DraftOutput } from "./types";

/* ------------------------------ Utils ------------------------------ */

function normalizeHashtags(tags: string[]): string[] {
  return (tags || [])
    .map((t) => String(t).trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`));
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

/* ------------------------------ Extra utils for Stage2 batch ------------------------------ */

function hasArabicScript(s: string) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(String(s || ""));
}

function hasCjkScript(s: string) {
  const t = String(s || "");
  return /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(t);
}

function isSingleLine(s: string) {
  return !/[\r\n]/.test(String(s || ""));
}

function extractHashtagsFromText(text: string): string[] {
  const matches = String(text || "").match(/#[\p{L}\p{N}_]+/gu);
  return matches ? matches.map((m) => m.trim()) : [];
}

function extractMentionsFromText(text: string): string[] {
  const matches = String(text || "").match(/@[\p{L}\p{N}_]+/gu);
  return matches ? matches.map((m) => m.trim()) : [];
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

function ensureSameMentionsAndHashtags(sourceText: string, translatedText: string) {
  const srcTags = extractHashtagsFromText(sourceText);
  const trTags = extractHashtagsFromText(translatedText);

  const srcMentions = extractMentionsFromText(sourceText);
  const trMentions = extractMentionsFromText(translatedText);

  if (!arraysEqualAsMultiset(srcTags, trTags)) return false;
  if (!arraysEqualAsMultiset(srcMentions, trMentions)) return false;
  return true;
}

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
  return String(raw || "")
    .replace(/\r/g, "")
    // Remove bidi / zero-width chars
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function stripCjkOutsideTagsMentions(text: string): string {
  const s = String(text || "");
  const tokens = s.split(/(\s+)/);

  return tokens
    .map((tok) => {
      if (!tok.trim()) return tok;
      if (tok.startsWith("#") || tok.startsWith("@")) return tok;
      return tok.replace(/[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/g, "");
    })
    .join("");
}

/* ------------------------------ Stage 2: Batch translation validator ------------------------------ */

function safeParseJson(raw: string): any {
  const trimmed = String(raw || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Very small fallback: try to extract first {...}
    const start = trimmed.indexOf("{");
    if (start === -1) throw new Error("INVALID_JSON_OUTPUT");
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < trimmed.length; i++) {
      const ch = trimmed[i];

      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === "{") depth++;
      if (ch === "}") depth--;

      if (depth === 0) {
        const extracted = trimmed.slice(start, i + 1);
        try {
          return JSON.parse(extracted);
        } catch {
          throw new Error("INVALID_JSON_OUTPUT");
        }
      }
    }

    throw new Error("INVALID_JSON_OUTPUT");
  }
}

/**
 * Batch Stage2 schema:
 * {"translations":[{"text":string}]}
 *
 * Returns a string[] where invalid items are set to "" (empty).
 * This is intentionally lenient to avoid wasting retries.
 */
export function validateTranslationBatchOutput(args: {
  raw: string;
  sources_en: string[];
}): string[] {
  const parsed = safeParseJson(args.raw);

  // Unwrap common wrapper if present (optional). If you want strict reject, remove this.
  const root =
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as any).translations)
      ? (parsed as any)
      : parsed &&
          typeof parsed === "object" &&
          (parsed as any).response &&
          typeof (parsed as any).response === "object" &&
          Array.isArray((parsed as any).response.translations)
        ? (parsed as any).response
        : null;

  if (!root) throw new Error("INVALID_TRANSLATION_JSON_SHAPE");

  if (root.translations.length !== args.sources_en.length) {
    throw new Error("INVALID_TRANSLATION_COUNT");
  }

  const out: string[] = [];

  for (let i = 0; i < args.sources_en.length; i++) {
    const src = String(args.sources_en[i] || "").trim();
    const rawText = String(root.translations[i]?.text ?? "").trim();

    // Default: empty string if anything looks suspicious
    if (!rawText) {
      out.push("");
      continue;
    }

    // Guard wrappers/JSON in item text (rare but possible)
    if (looksLikeJsonOrWrappedOutput(rawText)) {
      out.push("");
      continue;
    }

    // Normalize + best-effort strip CJK outside tags/mentions
    let t = normalizeTranslationText(rawText);
    t = stripCjkOutsideTagsMentions(t);
    t = normalizeTranslationText(t);

    if (!t) {
      out.push("");
      continue;
    }

    // Must be single line
    if (!isSingleLine(t)) {
      out.push("");
      continue;
    }

    // Hard reject any remaining CJK (including inside tags/mentions)
    if (hasCjkScript(t)) {
      out.push("");
      continue;
    }

    // Tags/mentions must match exactly as multiset
    if (!ensureSameMentionsAndHashtags(src, t)) {
      out.push("");
      continue;
    }

    // Optional: require it to look Persian-ish outside tags/mentions
    const stripped = t
      .replace(/#[\p{L}\p{N}_]+/gu, " ")
      .replace(/@[\p{L}\p{N}_]+/gu, " ")
      .trim();

    if (stripped && !hasArabicScript(stripped)) {
      out.push("");
      continue;
    }

    out.push(t);
  }

  return out;
}