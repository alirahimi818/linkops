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

export function buildDraftPrompt(input: GenerateInput): AIChatMessage[] {
  const allowed = normalizeHashtags(input.allowed_hashtags);
  const examplesBlock = formatExamples(input);

  const outputRules = [
    "Output rules (STRICT):",
    `- Return ONLY valid JSON: {"comments":[{"text":string}, ...]}`,
    `- Exactly ${input.count} comments`,
    `- Top-level key MUST be only "comments"`,
    `- Each "text": single line English, no \\n, 40–220 chars`,
    `- No extra text, no markdown, no fences, no explanation`,
  ].join("\n");

  const qualityRules = [
    "Quality rules (highest priority):",
    "- Write realistic English replies like Iranian users on X: casual, emotional, factual, supportive of freedom movement",
    "- Match the pro-freedom, pro-action spirit of the EXAMPLES — even if tone is described as neutral/measured",
    "- EVERY comment MUST include at least ONE specific detail from the input:",
    "  → death toll (36,500–50,000+ killed),",
    "  → 'help is on the way' broken promise,",
    "  → @TrumpDailyPosts poll,",
    "  → need to recognize Crown Prince / Reza Pahlavi as leader,",
    "  → call for no negotiation / maximum pressure / real support",
    "- Generic phrases like 'support the people' or 'enough is enough' alone are NOT sufficient",
    "- Paraphrase — never copy input text word-for-word",
    "- Vary openings, structures, lengths, emotions",
  ].join("\n");

  const varietyRules = [
    "Anti-repetition rules:",
    "- ≤ 2 comments starting with same word/phrase",
    "- No adjective repeated > 3 times across all comments",
    "- ≤ 4 questions total",
    "- Exclamation marks in ≤ 50% of comments",
    "- No repeated slogans or templates",
  ].join("\n");

  const antiSpamRules = [
    "Anti-spam rules:",
    "- NO emojis",
    "- No ALL CAPS except 1–2 words max",
    "- At least 4 comments with ZERO hashtags",
    "- At least 5 comments with ZERO @mentions",
    "- Avoid boilerplate justice/accountability phrases (max once)",
  ].join("\n");

  const mentionRules = [
    "Mention rules:",
    "- Optional, natural — max 2–3 @ per comment",
    "- Prefer relevant ones: @PahlaviReza, @realDonaldTrump, @POTUS, @SecRubio, @LindseyGrahamSC, @TrumpDailyPosts etc.",
  ].join("\n");

  const hashtagRules =
    allowed.length > 0
      ? [
          "Hashtag rules:",
          "- Optional, max 2–3 per comment",
          "- ONLY from allowed list: " + allowed.join(", "),
          "- At least 4 comments MUST have zero hashtags",
        ].join("\n")
      : "No hashtags allowed (empty list)";

  const finalGuard = [
    "Final priority:",
    "Naturalness + specificity + variety > everything else (except JSON format).",
    "If in doubt, make it more human-like and reference a concrete detail from the description.",
  ].join("\n");

  return [
    {
      role: "system",
      content: [
        "You generate short, realistic X replies in English from perspective of Iranian pro-freedom users.",
        "Return ONLY the JSON — nothing else.",
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
        "Input:",
        `Title (FA): ${input.title_fa || "(none)"}`,
        `Description (FA): ${input.description_fa || "(none)"}`,
        `Need (FA): ${input.need_fa || "(none)"}`,
        `Comment type (FA): ${input.comment_type_fa || "(none)"}`,
        `Desired tone: supportive yet measured (pro-freedom, factual, call for real action)`,
        "",
        `Stream/Topic: ${input.stream || ""} – ${input.topic || ""}`,
        "",
        `Allowed hashtags: ${allowed.length ? allowed.join(", ") : "NONE"}`,
        "",
        "Style examples (match tone/format/spirit):",
        examplesBlock || "No examples.",
        "",
        `Generate exactly ${input.count} natural, varied comments.`,
        "All should support YES vote in the poll, reference at least one specific detail, and feel authentic.",
        "Output JSON only.",
      ].join("\n"),
    },
  ];
}