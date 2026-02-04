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

  const outputRules = [
    "Output rules:",
    `- Output MUST match this JSON schema exactly: {"comments":[{"text":string}]}`,
    `- comments.length MUST equal ${input.count}`,
    "- Top-level JSON must contain ONLY the key 'comments' (no wrapper keys like 'response', 'usage', 'tool_calls').",
    "- Each text MUST be English (en).",
    "- Each text MUST be a single line (no line breaks).",
    "- Each text MUST be non-empty and under 220 characters.",
    "- No markdown, no code fences, no commentary.",
  ].join("\n");

  const qualityRules = [
    "Quality rules (VERY IMPORTANT):",
    "- Write like real X/Twitter replies: concise, punchy, natural.",
    "- Each comment must clearly relate to the given Title/Description (no generic filler).",
    "- Be specific: reference at least ONE concrete detail or entity from the input (a person/role, organization, event, claim, place, concept, or quoted idea).",
    "- Do NOT copy the Title/Description verbatim. Paraphrase.",
    "- Enforce variety: different openings, different verbs, different structure. No repetitive templates.",
    "- Avoid boilerplate phrases repeated across many items (e.g., do not repeat the same slogan in multiple comments).",
    "- Prefer one strong sentence or two short clauses; avoid essay tone.",
  ].join("\n");

  const antiSpamRules = [
    "Anti-spam constraints:",
    "- Hashtags are optional. Do NOT hashtag-stuff.",
    "- Mentions are optional. Do NOT mention-stuff.",
    "- At least 3 comments must have NO hashtags (if hashtags are allowed).",
    "- At least 3 comments must have NO @mentions.",
    "- No emojis.",
    "- No numbered lists.",
    "- Avoid legal/boilerplate phrasing like 'must be held accountable' unless used at most once.",
  ].join("\n");

  const mentionRules = [
    "Mention rules:",
    "- You MAY include @mentions if they fit naturally (learn from examples).",
    "- At most 0–3 mentions per comment.",
    "- Use mentions only when they make sense in the sentence (no random tagging).",
  ].join("\n");

  const hashtagRules =
    allowed.length > 0
      ? [
          "Hashtag rules:",
          "- You MAY include hashtags, but at most 0–2 per comment.",
          "- If you include hashtags, they MUST be ONLY from the allowed list (exact match).",
          "- Do NOT invent new hashtags.",
          "- Do NOT translate hashtags.",
        ].join("\n")
      : [
          "Hashtag rules:",
          "- Allowed list is empty: do NOT include any hashtags.",
        ].join("\n");

  return [
    {
      role: "system",
      content: [
        "You generate short social media reply comments in English.",
        "Return ONLY valid JSON. No markdown. No extra text.",
        "",
        outputRules,
        "",
        qualityRules,
        "",
        antiSpamRules,
        "",
        mentionRules,
        "",
        hashtagRules,
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