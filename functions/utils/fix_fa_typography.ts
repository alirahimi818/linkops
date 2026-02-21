// Fix common Persian (Farsi) typography issues while keeping hashtags/mentions/URLs intact.
export function fixFaTypography(input: string) {
  // Coerce null/undefined to an empty string so the function is safe for any input.
  let t = String(input ?? "");

  // 1) Protect hashtags, mentions, URLs (do not touch them)
  // Temporarily replace matched segments with placeholders so later rules won't alter them.
  const protectedParts: string[] = [];
  const protect = (s: string) => {
    protectedParts.push(s);
    return `__P${protectedParts.length - 1}__`;
  };

  // Protect URLs first so @/# inside URLs won't be treated as mentions/hashtags.
  t = t.replace(/https?:\/\/\S+/gi, protect);
  // Protect @mentions and #hashtags (including Persian/Arabic letters).
  t = t.replace(/[@#][\w\u0600-\u06FF_]+/g, protect);

  // 2) Normalize Arabic characters to Persian equivalents.
  t = t
    .replace(/ك/g, "ک")
    .replace(/ي/g, "ی")
    .replace(/ى/g, "ی")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/إ|أ/g, "ا")
    .replace(/ـ/g, ""); // Remove tatweel/kashida elongation character.

  // 3) Basic whitespace cleanup.
  t = t.replace(/[ \t]{2,}/g, " ").trim();

  // 4) Insert ZWNJ after "می"/"نمی" when used as a prefix (e.g., "می رود" -> "می‌رود").
  t = t.replace(/\b(ن?می)\s+([\u0600-\u06FF])/g, "$1\u200c$2");

  // 5) Insert ZWNJ before common plural suffixes "ها"/"های" (with or without spaces).
  t = t
    .replace(/([\u0600-\u06FF])\s*ها\b/g, "$1\u200cها")
    .replace(/([\u0600-\u06FF])\s*های\b/g, "$1\u200cهای");

  // 6) Insert ZWNJ before the superlative suffix "ترین" (safer than handling "تر").
  // Only applies when the base word is at least 3 Persian/Arabic letters to reduce false positives.
  t = t.replace(/([\u0600-\u06FF]{3,})\s*ترین\b/g, "$1\u200cترین");

  // 7) High-frequency, low-risk lexical fixes for common mistakes.
  t = t
    .replace(/\bهستهای\b/g, "هسته‌ای")
    // Normalize "آیت‌الله" with ZWNJ so suffix rules behave consistently.
    .replace(/آیت\s*الله/g, "آیت\u200cالله");

  // 8) Final whitespace polish.
  t = t.replace(/[ \t]{2,}/g, " ").trim();

  // 9) Restore protected parts (URLs/mentions/hashtags).
  t = t.replace(/__P(\d+)__/g, (_, i) => protectedParts[Number(i)] ?? "");

  return t;
}