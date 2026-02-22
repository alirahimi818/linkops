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
  const normalize = (arr: string[]) => arr.map(x => x.toLowerCase()).sort();
  const normA = normalize(a);
  const normB = normalize(b);
  return normA.every((val, idx) => val === normB[idx]);
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
    return null;
  }
}

function stripCodeFences(text: string) {
  return String(text || "").replace(/```[\s\S]*?```/g, " ");
}

function stripBulletsAndNumbering(line: string) {
  // Remove common leading bullets/numbering like: "- ", "* ", "1) ", "1. ", "• "
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
    // No whitelist → remove all hashtags for safety
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

/* ------------------------------ Stage 0+1 (Autofill: Meta + Draft) ------------------------------ */

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
  const maxItems = Math.max(5, Math.min(30, Number(args.count || 10) * 2));

  let lines = (args.candidates || [])
    .map((l) => stripBulletsAndNumbering(normalizeLine(l)))
    .map((l) => normalizeLine(l))
    .map((l) => l.replace(/[\r\n]/g, " ").trim())
    .filter((l) => l.length > 0)
    .filter(isSingleLine)
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
    .map(normalizeLine)
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

/* ------------------------------ Stage 1 (English Draft) ------------------------------ */

export function validateDraftOutput(args: {
  raw: string;
  count: number;
  allowed_hashtags: string[];
}): DraftOutput {
  const allowed = new Set(normalizeHashtags(args.allowed_hashtags));
  const maxItems = Math.max(5, Math.min(30, Number(args.count || 10) * 2));

  const parsed = safeParseJson(args.raw);

  let candidates: string[] = [];

  if (parsed && typeof parsed === "object" && Array.isArray(parsed.comments)) {
    // JSON format
    candidates = parsed.comments
      .map((c: any) => normalizeLine(String(c?.text || "")))
      .filter(Boolean);
  } else {
    // Plain text: one comment per line
    const cleaned = stripCodeFences(args.raw);
    candidates = String(cleaned || "")
      .replace(/\r/g, "")
      .split("\n")
      .map(stripBulletsAndNumbering)
      .map(normalizeLine)
      .filter(Boolean);
  }

  let lines = candidates
    .map(normalizeLine)
    .map((l) => l.replace(/[\r\n]/g, " ").trim())
    .filter((l) => l.length > 0)
    .filter(isSingleLine)
    .filter((l) => !hasArabicScript(l))
    .filter((l) => !hasCjkScript(l))
    .filter((l) => !looksLikeWrappedOrMarkdown(l));

  lines = lines.map((l) => removeIllegalHashtags(l, allowed)).filter(Boolean);
  lines = dedupeCaseInsensitive(lines, maxItems);

  if (lines.length === 0) {
    throw new Error("NO_USABLE_DRAFT_LINES");
  }

  return {
    comments: lines.map((text) => ({ text })),
  };
}

/* ------------------------------ Stage 2 (Persian Translation Batch) ------------------------------ */

function normalizeTranslationText(raw: string) {
  return String(raw || "")
    .replace(/\r/g, "")
    // Remove problematic bidi / control characters, but KEEP ZWNJ (U+200C)
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/[ \t]{2,}/g, " ")
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

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.translations)) {
    throw new Error("INVALID_TRANSLATION_JSON_SHAPE");
  }

  const translationsRaw = parsed.translations as any[];
  const n = args.sources_en.length;

  // Normalize to string[]
  let translationsNorm: string[] = translationsRaw.map((item: any) => {
    if (typeof item === "string") return item.trim();
    if (item && typeof item === "object") return String(item.text ?? "").trim();
    return "";
  });

  // Handle collapsed output (all in one blob)
  const nonEmpty = translationsNorm.filter(Boolean);
  if (n > 1 && (translationsNorm.length === 1 || nonEmpty.length === 1)) {
    const blob = (nonEmpty[0] ?? translationsNorm[0] ?? "").trim();

    let parts = blob
      .split("\n")
      .map((x) => x.replace(/[\r\n]/g, " ").trim())
      .filter(Boolean);

    if (parts.length < n) {
      parts = blob
        .split(/(?<=#[\p{L}\p{N}_]+)\s*(?=[^#\s])/gu)
        .map((x) => x.trim())
        .filter(Boolean);
    }

    if (parts.length < n) {
      parts = blob
        .split(/(?<=[.!?؟])\s+/g)
        .map((x) => x.trim())
        .filter(Boolean);
    }

    translationsNorm = Array(n).fill("").map((_, i) => parts[i] ?? "");
  }

  const out: string[] = [];

  for (let i = 0; i < n; i++) {
    const src = String(args.sources_en[i] || "").trim();
    let t = String(translationsNorm[i] ?? "").trim();

    // Quick rejects
    if (!t || looksLikeWrappedOrMarkdown(t)) {
      out.push("");
      continue;
    }

    // Gentle normalization
    t = normalizeTranslationText(t);
    t = stripCjkOutsideTagsMentions(t);
    t = normalizeTranslationText(t);

    if (!t) {
      out.push("");
      continue;
    }

    // If multi-line → keep only first line instead of discarding
    if (!isSingleLine(t)) {
      t = t.split(/[\r\n]+/)[0].trim();
      if (!t) {
        out.push("");
        continue;
      }
    }

    if (hasCjkScript(t)) {
      out.push("");
      continue;
    }

    if (!ensureSameMentionsAndHashtags(src, t)) {
      console.log(`Rejected line ${i} - MENTIONS/HASHTAGS MISMATCH`);
      console.log("Source mentions:", extractMentionsFromText(src));
      console.log("Trans mentions:", extractMentionsFromText(t));
      console.log("Source hashtags:", extractHashtagsFromText(src));
      console.log("Trans hashtags:", extractHashtagsFromText(t));
      out.push("");
      continue;
    }

    // Very relaxed Persian check: only reject if almost no Persian chars + meaningful length
    const stripped = t
      .replace(/#[\p{L}\p{N}_]+/gu, " ")
      .replace(/@[\p{L}\p{N}_]+/gu, " ")
      .trim();

    if (stripped.length > 5) {
      const persianCount = (stripped.match(/[\u0600-\u06FF]/g) || []).length;
      if (persianCount < 3 && stripped.length > 20) {
        out.push("");
        continue;
      }
    }

    // Accepted
    out.push(t);
  }

  return out;
}