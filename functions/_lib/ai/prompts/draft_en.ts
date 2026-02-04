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
    "Output rules – strict:",
    `- ONLY return valid JSON: {"comments":[{"text":string}, ...]}`,
    `- Exactly ${input.count} comments – no more, no less`,
    `- Each "text" must be single-line English, no line breaks, no markdown`,
    `- Each comment length: 100–280 characters (aim for 140–220 like examples)`,
    `- Comments shorter than 100 chars are NOT acceptable`,
    `- No extra text outside the JSON`,
  ].join("\n");

  const qualityRules = [
    "Quality & style rules (highest priority):",
    "- Write like real Iranian pro-freedom users on X: emotional, resolute, factual, urgent",
    "- Match the ENERGY, tone and structure of the provided EXAMPLES (strong support for YES, outrage at massacre, broken promises, call for recognition of Reza Pahlavi, maximum pressure, no negotiation)",
    "- EVERY comment MUST reference at least 1–2 specific details from description:",
    "  • death toll (36,500–50,000+ killed / slaughtered / massacred)",
    "  • broken promise 'help is on the way'",
    "  • @TrumpDailyPosts poll",
    "  • need to recognize Crown Prince / Reza Pahlavi / @PahlaviReza as legitimate leader",
    "  • no negotiation / maximum pressure / real action / regime change",
    "- Use strong, emotional language when appropriate: slaughtered, massacred, blood of our youth, broken promises, demands justice, etc.",
    "- Vary sentence structure, openings, length and emotional intensity",
    "- Paraphrase – NEVER copy input or examples verbatim",
  ].join("\n");

  const engagementRules = [
    "Engagement rules (natural usage):",
    "- Use 1–3 relevant hashtags in 5–8 comments (ONLY from allowed list)",
    "- Use 1–3 natural @mentions in 4–7 comments (e.g. @PahlaviReza, @TrumpDailyPosts, @realDonaldTrump, @POTUS, @SecRubio, @LindseyGrahamSC)",
    "- At least 2–3 comments without hashtag",
    "- At least 3 comments without any @mention",
  ].join("\n");

  const varietyRules = [
    "Variety & anti-repetition rules:",
    "- Maximum 2 comments starting with the same word or phrase",
    "- No adjective or strong verb repeated more than 3 times across all comments",
    "- At most 3–4 questions in total",
    "- Exclamation marks in at most 60% of comments",
    "- Avoid repetitive templates or slogans",
  ].join("\n");

  const antiSpamRules = [
    "Anti-spam / anti-bot rules:",
    "- NO emojis at all",
    "- No ALL CAPS except 1–2 words maximum",
    "- Avoid generic boilerplate phrases like 'justice must prevail' (max once)",
  ].join("\n");

  const finalGuard = [
    "Final instruction:",
    "Prioritize: specificity → natural emotional energy of examples → length (140–220 chars) → variety → natural hashtag/mention usage",
    "If a comment feels too short, generic or safe → rewrite it to be longer, stronger and more detailed.",
  ].join("\n");

  return [
    {
      role: "system",
      content: [
        "You are generating realistic, high-engagement X/Twitter replies in English from the perspective of Iranian pro-freedom / pro-revolution users.",
        "Return ONLY valid JSON – nothing else, no explanation, no markdown.",
        "",
        outputRules,
        "",
        qualityRules,
        "",
        engagementRules,
        "",
        varietyRules,
        "",
        antiSpamRules,
        "",
        finalGuard,
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "Current input:",
        `Title (FA): ${input.title_fa || "(none)"}`,
        `Description (FA): ${input.description_fa || "(none)"}`,
        `Need (FA): ${input.need_fa || "(none)"}`,
        `Comment type (FA): ${input.comment_type_fa || "(none)"}`,
        `Desired tone: supportive and resolute (pro-freedom, factual but urgent, match examples' energy)`,
        "",
        `Stream/Topic: ${input.stream || ""} – ${input.topic || ""}`,
        "",
        `Allowed hashtags: ${allowed.length ? allowed.join(", ") : "NONE"}`,
        "",
        "Style examples – match tone, energy, length, use of mentions & hashtags:",
        examplesBlock || "No examples provided.",
        "",
        `Generate exactly ${input.count} varied, authentic replies.`,
        "All must:",
        "- Strongly support YES in the @TrumpDailyPosts poll",
        "- Include at least 1–2 specific details from description (death toll, broken promise, Reza Pahlavi recognition, etc.)",
        "- Aim for 140–220 characters each (like examples)",
        "- Use hashtags and mentions naturally where it makes sense",
        "Output JSON only.",
      ].join("\n"),
    },
  ];
}