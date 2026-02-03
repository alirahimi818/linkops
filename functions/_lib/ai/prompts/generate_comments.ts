import type { AIChatMessage, GenerateInput } from "../types";

function normalizeHashtags(tags: string[]): string[] {
  return (tags || [])
    .map((t) => String(t).trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`));
}

export function buildGeneratePrompt(input: GenerateInput): AIChatMessage[] {
  const allowed = normalizeHashtags(input.allowed_hashtags);
  const examples = allowed.length === 0 ? [] : (input.examples?.slice(0, 10) ?? []);

  const examplesBlock =
    examples.length === 0
      ? "No examples provided."
      : examples
          .map((e, i) => {
            const t = String(e.text || "").trim();
            const tr = String(e.translation_text || "").trim();
            return [
              `Example ${i + 1}:`,
              `- text (EN): ${t}`,
              tr ? `- translation (FA): ${tr}` : undefined,
            ]
              .filter(Boolean)
              .join("\n");
          })
          .join("\n\n");

  // Fixed context for your product
  const fixedContext = [
    "Context is fixed:",
    "- Topic: Political discourse about Iran and a revolutionary movement in January 2026.",
    "- Platform: Social media replies (X / Instagram style).",
    "- Goal: Provide natural, human-like reply comments suitable for public posting.",
    "- Safety/quality: Avoid incitement or instructions for wrongdoing; keep it conversational and non-violent.",
  ].join("\n");

  return [
    {
      role: "system",
      content: [
        "You generate social media reply comments.",
        "Return ONLY valid JSON. No markdown. No extra text.",
        fixedContext,
        "",
        "The input fields (title/description/need/comment_type) may be Persian (fa). Do NOT translate them in the output.",
        "Output rules:",
        `- Output must match this JSON schema exactly: {"comments":[{"text":string,"translation_text":string,"hashtags_used":string[]}]}`,
        `- comments.length MUST equal ${input.count}`,
        "- text MUST be English (en).",
        `- Each "text" MUST be a single line (no line breaks).`,
        `- Each "translation_text" MUST be a single line (no line breaks).`,
        `- "translation_text" MUST use Persian (Arabic script) characters only. Do NOT use Latin, Cyrillic, or CJK characters.`,
        `- Return ONLY valid JSON. No extra text before/after.`,
        "- translation_text MUST be Persian (fa).",
        "- hashtags_used MUST only include hashtags from the allowed list.",
        "- If allowed list is empty, hashtags_used must be [].",
        "- text may include hashtags only from hashtags_used.",
        "- Do NOT invent new hashtags.",
        "- Keep comments natural and non-spammy.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "User inputs (Persian):",
        `- Title (FA): ${input.title_fa}`,
        `- Description (FA): ${input.description_fa}`,
        `- Need (FA): ${input.need_fa}`,
        `- Comment type (FA): ${input.comment_type_fa}`,
        `- Tone: ${input.tone}`,
        "",
        `Allowed hashtags: ${JSON.stringify(allowed)}`,
        "",
        "Style examples (use them to match tone/format):",
        examplesBlock,
        "",
        `Now generate exactly ${input.count} comments and return JSON only.`,
      ].join("\n"),
    },
  ];
}
