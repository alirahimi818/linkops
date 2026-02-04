import type { AIChatMessage, GenerateInput } from "../types";

function normalizeHashtags(tags: string[]): string[] {
  return (tags || [])
    .map((t) => String(t).trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`));
}

function formatExamples(input: GenerateInput): string {
  const examples = (input.examples?.slice(0, 10) ?? []).filter((e) =>
    String(e?.text || "").trim(),
  );

  if (examples.length === 0) return "No examples provided.";

  return examples
    .map((e, i) => {
      const t = String(e.text || "").trim();
      // Examples may be multi-line. Keep as-is.
      return [`Example ${i + 1}:`, `- text (EN): ${t}`].join("\n");
    })
    .join("\n\n");
}

/**
 * Stage 1: Generate English comments only.
 * Output schema:
 * {"comments":[{"text":string}]}
 */
export function buildDraftPrompt(input: GenerateInput): AIChatMessage[] {
  const allowed = normalizeHashtags(input.allowed_hashtags);
  const examplesBlock = formatExamples(input);

  const mustUseHashtags = allowed.length > 0;

  const qualityRules = [
    "Quality rules (VERY IMPORTANT):",
    "- Write like X/Twitter replies: concise, punchy, natural.",
    "- Each comment should feel specific to the given title/description (avoid generic filler).",
    "- Avoid bland templates like 'must be held accountable' repeated across many items.",
    "- Ensure diversity: do not reuse the same opening phrase or sentence structure across comments.",
    "- Prefer 1–2 short clauses over long paragraphs.",
    "- Keep each comment under 220 characters (hard limit).",
    "",
    "Content hooks (include at least ONE in every comment):",
    "- 'peace through strength' / 'no deals' / 'no negotiations'",
    "- 'maximum pressure'",
    "- 'stand with the Iranian people'",
    "- recognition/support phrasing for @PahlaviReza (only if it fits naturally)",
  ].join("\n");

  const hashtagRules = [
    "Hashtag & mention rules:",
    "- You MAY include @mentions if they fit the style (learn from examples).",
    mustUseHashtags
      ? "- Include 1 to 3 hashtags in EACH comment, chosen ONLY from the allowed list."
      : "- Do NOT include any hashtags (allowed list is empty).",
    "- Do NOT invent new hashtags.",
    "- Do NOT translate hashtags.",
  ].join("\n");

  return [
    {
      role: "system",
      content: [
        "You generate short social media reply comments in English.",
        "Return ONLY valid JSON. No markdown. No extra text.",
        "",
        "Output rules:",
        `- Output MUST match this JSON schema exactly: {"comments":[{"text":string}]}`,
        `- comments.length MUST equal ${input.count}`,
        "- Each text MUST be English (en).",
        "- Each text MUST be a single line (no line breaks).",
        "- Each text MUST be non-empty and under 220 characters.",
        "",
        qualityRules,
        "",
        hashtagRules,
        "",
        "Hard constraints:",
        "- No numbering (no '1)', '2)', etc.).",
        "- No emojis.",
        "- No quotes longer than 12 words.",
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
        `- Stream: ${input.stream}`,
        `- Topic: ${input.topic}`,
        "",
        `Allowed hashtags: ${JSON.stringify(allowed)}`,
        "",
        "Style examples (match tone/format; mentions/hashtags may appear):",
        examplesBlock,
        "",
        `Now generate exactly ${input.count} comments and return JSON only.`,
      ].join("\n"),
    },
  ];
}
