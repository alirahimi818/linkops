import type { DraftOutput } from "./types";

/* ------------------------------ Helpers ------------------------------ */

function normalizeHashtags(tags: string[]): string[] {
  return (tags || [])
    .map((t) => String(t).trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`));
}

function isSingleLine(s: string) {
  return !/[\r\n]/.test(String(s || ""));
}

function hasArabicScript(s: string) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(String(s || ""));
}

function hasCjkScript(s: string) {
  const t = String(s || "");
  return /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(t);
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

function looksLikeWrappedOrMarkdown(s: string) {
  const t = String(s || "").trim();
  if (!t) return false;
  if (t.startsWith("```") || t.includes("```")) return true;
  if (t.startsWith("{") || t.startsWith("[")) return true;
  return false;
}

function safeParseJson(raw: string): any | null {
  const t = String(raw || "").trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    // If it is not JSON, we treat it as plain text.
    return null;
  }
}

function stripCodeFences(text: string) {
  let s = String(text || "");
  s = s.replace(/```[\s\S]*?```/g, " ");
  return s;
}

function stripBulletsAndNumbering(line: string) {
  // remove common leading bullets/numbering like:
  // "- ", "* ", "1) ", "1. ", "• "
  return String(line || "")
    .replace(/^\s*(?:[-*•]|(\d+)[\.\)]|(\d+)\s+-)\s+/u, "")
    .trim();
}

function normalizeLine(line: string) {
  return String(line || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function removeIllegalHashtags(text: string, allowed: Set<string>) {
  if (allowed.size === 0) {
    // if no whitelist, just remove all hashtags to be safe
    return String(text || "").replace(/#[\p{L}\p{N}_]+/gu, "").replace(/[ \t]{2,}/g, " ").trim();
  }

  return String(text || "").replace(/#[\p{L}\p{N}_]+/gu, (m) => {
    const tag = m.trim();
    return allowed.has(tag) ? tag : "";
  }).replace(/[ \t]{2,}/g, " ").trim();
}

function dedupeCaseInsensitive(lines: string[], maxItems: number) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const l of lines) {
    const key = l.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
    if (out.length >= maxItems) break;
  }

  return out;
}

/* ------------------------------ Stage 0+1 (Autofill: Meta + Draft in one plain-text) ------------------------------ */

export type AutofillDraftWithMeta = {
  meta: { title: string; description: string };
  draft: DraftOutput;
};

function cleanDraftLines(args: {
  candidates: string[];
  allowed_hashtags: string[];
  count: number;
}): DraftOutput {
  const allowed = new Set(normalizeHashtags(args.allowed_hashtags));
  const maxItems = Math.max(5, Math.min(30, Number(args.count || 10) * 2)); // allow extra headroom

  let lines = (args.candidates || [])
    .map((l) => stripBulletsAndNumbering(normalizeLine(l)))
    .map((l) => normalizeLine(l))
    .map((l) => l.replace(/[\r\n]/g, " ").trim())
    .filter((l) => l.length > 0)
    .filter((l) => isSingleLine(l))
    .filter((l) => !hasArabicScript(l))
    .filter((l) => !hasCjkScript(l))
    .filter((l) => !looksLikeWrappedOrMarkdown(l));

  lines = lines.map((l) => removeIllegalHashtags(l, allowed)).filter(Boolean);
  lines = dedupeCaseInsensitive(lines, maxItems);

  if (lines.length === 0) throw new Error("NO_USABLE_DRAFT_LINES");

  return { comments: lines.map((text) => ({ text })) };
}

export function validateAutofillDraftWithMeta(args: {
  raw: string;
  count: number;
  allowed_hashtags: string[];
}): AutofillDraftWithMeta {
  const cleaned = stripCodeFences(args.raw);

  const allLines = String(cleaned || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => normalizeLine(l))
    .filter(Boolean);

  const sepIdx = allLines.findIndex((l) => l.trim() === "---");
  if (sepIdx < 0) throw new Error("AUTOFILL_MISSING_SEPARATOR");

  const header = allLines.slice(0, sepIdx);
  const body = allLines.slice(sepIdx + 1);

  let title = "";
  const descLines: string[] = [];

  for (const l of header) {
    if (/^TITLE_FA:/i.test(l)) {
      title = normalizeLine(l.replace(/^TITLE_FA:\s*/i, ""));
      continue;
    }
    if (/^DESC_FA:/i.test(l)) {
      const d = normalizeLine(l.replace(/^DESC_FA:\s*/i, ""));
      if (d) descLines.push(d);
      continue;
    }
  }

  const description = descLines.slice(0, 3).join("\n");

  const draft = cleanDraftLines({
    candidates: body,
    allowed_hashtags: args.allowed_hashtags,
    count: args.count,
  });

  return { meta: { title: title || "", description: description || "" }, draft };
}

/* ------------------------------ Stage 1 (Draft) ------------------------------ */
/**
 * Accepts either:
 * - Plain text: one comment per line (recommended)
 * - JSON: {"comments":[{"text": "..."}]}
 *
 * Returns DraftOutput with lenient cleanup:
 * - NEVER enforces count
 * - Drops invalid lines instead of throwing (unless nothing usable)
 * - Removes illegal hashtags instead of throwing
 */
export function validateDraftOutput(args: {
  raw: string;
  count: number; // kept for compatibility, not enforced
  allowed_hashtags: string[];
}): DraftOutput {
  const allowed = new Set(normalizeHashtags(args.allowed_hashtags));
  const maxItems = Math.max(5, Math.min(30, Number(args.count || 10) * 2)); // allow extra headroom

  const parsed = safeParseJson(args.raw);

  let candidates: string[] = [];

  // Case A: JSON output
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).comments)) {
    candidates = (parsed as any).comments
      .map((c: any) => normalizeLine(String(c?.text || "")))
      .filter(Boolean);
  } else {
    // Case B: Plain text output
    const cleaned = stripCodeFences(args.raw);
    candidates = String(cleaned || "")
      .replace(/\r/g, "")
      .split("\n")
      .map((l) => stripBulletsAndNumbering(normalizeLine(l)))
      .filter(Boolean);
  }

  // Normalize + filter hard constraints
  let lines = candidates
    .map((l) => normalizeLine(l))
    .map((l) => l.replace(/[\r\n]/g, " ").trim())
    .filter((l) => l.length > 0)
    .filter((l) => isSingleLine(l))
    // If model accidentally outputs Persian/Arabic or CJK in the English draft, drop the line
    .filter((l) => !hasArabicScript(l))
    .filter((l) => !hasCjkScript(l))
    // Remove wrapper-y artifacts
    .filter((l) => !looksLikeWrappedOrMarkdown(l));

  // Remove illegal hashtags (do not fail)
  lines = lines.map((l) => removeIllegalHashtags(l, allowed)).filter(Boolean);

  // Dedupe + cap
  lines = dedupeCaseInsensitive(lines, maxItems);

  if (lines.length === 0) {
    // One retry is fine, but don't keep failing silently; signal upstream
    throw new Error("NO_USABLE_DRAFT_LINES");
  }

  return {
    comments: lines.map((text) => ({ text })),
  };
}

/* ------------------------------ Stage 2 (Translation) ------------------------------ */

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

export function validateTranslationBatchOutput(args: {
  raw: string;
  sources_en: string[];
}): string[] {
  const parsed = safeParseJson(args.raw);

  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as any).translations)) {
    throw new Error("INVALID_TRANSLATION_JSON_SHAPE");
  }

  const translationsRaw = (parsed as any).translations as any[];
  const n = args.sources_en.length;

  // Normalize possible shapes into string[]
  let translationsNorm: string[] = translationsRaw.map((item: any) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") return String(item.text ?? "");
    return "";
  });

  // If model collapsed everything into one blob, try to split it into n parts.
  const nonEmpty = translationsNorm.filter((x) => String(x || "").trim().length > 0);

  if (n > 1 && (translationsNorm.length === 1 || nonEmpty.length === 1)) {
    const blob = String((nonEmpty[0] ?? translationsNorm[0] ?? "")).trim();

    let parts = blob
      .split("\n")
      .map((x) => String(x || "").replace(/[\r\n]/g, " ").trim())
      .filter(Boolean);

    // If still not enough parts, split by hashtag boundaries (works well for your outputs)
    if (parts.length < n) {
      parts = blob
        .split(/(?<=#[\p{L}\p{N}_]+)\s*(?=[^#\s])/gu)
        .map((x) => String(x || "").replace(/[\r\n]/g, " ").trim())
        .filter(Boolean);
    }

    // Last resort: split by sentence endings
    if (parts.length < n) {
      parts = blob
        .split(/(?<=[.!?؟])\s+/g)
        .map((x) => String(x || "").replace(/[\r\n]/g, " ").trim())
        .filter(Boolean);
    }

    translationsNorm = new Array(n).fill("").map((_, i) => parts[i] ?? "");
  }

  const out: string[] = [];

  for (let i = 0; i < n; i++) {
    const src = String(args.sources_en[i] || "").trim();
    const rawText = String(translationsNorm[i] ?? "").trim();

    if (!rawText) {
      out.push("");
      continue;
    }

    if (looksLikeWrappedOrMarkdown(rawText)) {
      out.push("");
      continue;
    }

    let t = normalizeTranslationText(rawText);
    t = stripCjkOutsideTagsMentions(t);
    t = normalizeTranslationText(t);

    if (!t) {
      out.push("");
      continue;
    }

    if (!isSingleLine(t)) {
      out.push("");
      continue;
    }

    if (hasCjkScript(t)) {
      out.push("");
      continue;
    }

    if (!ensureSameMentionsAndHashtags(src, t)) {
      out.push("");
      continue;
    }

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