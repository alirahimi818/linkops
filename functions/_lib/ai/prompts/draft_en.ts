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
      return [`Example ${i + 1}:`, `- text (EN): ${t}`].join("\n");
    })
    .join("\n\n");
}

/**
 * Stage 1: Generate English comments only.
 * Output schema: {"comments":[{"text":string}]}
 */
export function buildDraftPrompt(input: GenerateInput): AIChatMessage[] {
  const allowed = normalizeHashtags(input.allowed_hashtags);
  const examplesBlock = formatExamples(input);

  const outputRules = [
    "Output rules (MUST follow exactly):",
    `- Return ONLY valid JSON: {"comments":[{"text":string}, ...]}`,
    `- Exactly ${input.count} comments (no more, no less)`,
    `- Top-level object MUST have ONLY the key "comments"`,
    `- Each "text" MUST be plain English, single line, no \\n, no markdown`,
    `- Each text: 40–220 characters, non-empty`,
    `- No extra text, no explanation, no code fences`,
  ].join("\n");

  const qualityRules = [
    "Quality & Naturalness rules (highest priority):",
    "- Sound like real Iranian/Persian users writing English replies on X (casual, emotional, sometimes code-switch vibe but English only)",
    "- Use common Iranian X-style phrases when natural: 'shame on...', 'how dare you', 'blood on their hands', 'enough is enough', 'same old lies', 'wake up', 'they don't care about people', 'disgusting', 'criminal regime', etc.",
    "- MUST include at least ONE specific detail from Title/Description in EVERY comment (name, date, number, place, action, quote, institution, symbol – generic rants NOT allowed)",
    "- Paraphrase – never copy input text verbatim",
    "- Maximize variety: different openings, lengths, structures, emotions, verbs",
    "- Vary sentence length: very short (5–15 words), medium, one or two slightly longer",
    "- Tone MUST match input.tone but with natural emotional range",
  ].join("\n");

  const varietyRules = [
    "Strict anti-repetition rules:",
    "- No more than 2 comments can start with the same word/phrase",
    "- No adjective/adverb used more than twice across all comments",
    "- At most 3–4 questions in total",
    "- Exclamation marks in ≤ 45% of comments",
    "- No repeated slogans, templates or structures (e.g. avoid many 'This is X. We must Y.')",
  ].join("\n");

  const antiSpamRules = [
    "Anti-spam / anti-bot rules – very strict:",
    "- NO emojis at all",
    "- No numbered lists, no ALL CAPS shouting (except 1–2 words max)",
    "- At least 5 comments with ZERO hashtags",
    "- At least 6 comments with ZERO @mentions",
    "- Avoid repetitive boilerplate like 'must be held accountable', 'justice will prevail' (max once)",
  ].join("\n");

  const mentionRules = [
    "Mention rules:",
    "- Optional, natural only – at most 2 @ per comment",
    "- Only relevant real accounts an angry/sarcastic Iranian user would tag",
    "- Never random or forced tagging",
  ].join("\n");

  const hashtagRules =
    allowed.length > 0
      ? [
          "Hashtag rules – strict:",
          "- Optional, max 2 per comment",
          "- ONLY from this exact allowed list: " + allowed.join(", "),
          "- Do NOT invent, translate or modify hashtags",
          "- At least 5 comments MUST have zero hashtags",
        ].join("\n")
      : [
          "Hashtag rules:",
          "- Allowed list is empty → ZERO hashtags allowed in any comment",
        ].join("\n");

  const finalGuard = [
    "Final instruction:",
    "Prioritize naturalness, variety and specificity above everything else (except JSON format).",
    "If something feels repetitive/spammy/generic → rewrite it to be more varied/human.",
  ].join("\n");

  return [
    {
      role: "system",
      content: [
        "You generate short, realistic X/Twitter-style English replies from the perspective of Iranian users.",
        "Return ONLY the JSON array – nothing else.",
        "",
        outputRules,
        "",
        qualityRules,
        "",
        varietyRules,
        "",
        antiSpamRules,
        "",
        mentionRules,
        "",
        hashtagRules,
        "",
        finalGuard,
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "Input (Persian):",
        `Title (FA): ${input.title_fa || "(none)"}`,
        `Description (FA): ${input.description_fa || "(none)"}`,
        `Need/Context (FA): ${input.need_fa || "(none)"}`,
        `Comment type (FA): ${input.comment_type_fa || "(none)"}`,
        `Desired tone: ${input.tone || "angry/outraged"}`,
        "",
        `Stream/Topic: ${input.stream || ""} – ${input.topic || ""}`,
        "",
        `Allowed hashtags: ${allowed.length ? allowed.join(", ") : "NONE"}`,
        "",
        "Style examples (match tone, format, natural feel):",
        examplesBlock || "No examples provided.",
        "",
        `Generate exactly ${input.count} unique, natural-sounding comments.`,
        "Output JSON only.",
      ].join("\n"),
    },
  ];
}