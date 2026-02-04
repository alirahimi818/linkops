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
      // Examples may be multi-line. Keep as-is for style learning.
      return [`Example ${i + 1}:`, `- text (EN): ${t}`].join("\n");
    })
    .join("\n\n");
}

function describeTone(tone: string): string {
  switch (tone) {
    case "angry":
      return "Angry, raw, confrontational. Short sentences. Direct blame. No politeness.";
    case "outraged":
      return "Morally outraged. Emphasize injustice, shock, and betrayal.";
    case "demanding":
      return "Demanding and assertive. Clear calls for action. No hedging language.";
    case "urgent":
      return "Urgent and time-sensitive. Emphasize consequences of delay.";
    case "sad":
      return "Grieving and heavy. Focus on loss, pain, and human cost.";
    case "hopeful":
      return "Cautiously hopeful. Acknowledge pain but point to possible change.";
    case "defiant":
      return "Defiant and unyielding. Emphasize resistance and refusal to submit.";
    case "sarcastic":
      return "Dry, sarcastic, biting. Controlled irony, not jokes.";
    case "calm_firm":
      return "Calm but firm. Serious, controlled, and resolute.";
    case "neutral":
    default:
      return "Emotionally neutral but still human. No strong emotional language.";
  }
}

function buildCoreContext(input: GenerateInput): string {
  // Keep this as soft background, not an instruction to mention specific names/slogans.
  // Only used for Iran political topic to improve grounding.
  if (
    input.stream !== "political" ||
    input.topic !== "iran_revolution_jan_2026"
  ) {
    return "";
  }

  return [
    "Background context for Iran-related political content (do NOT quote directly; do NOT force names/slogans):",
    "- In early 2026, Iran has faced intense nationwide unrest following major protests that began in late December 2025.",
    "- Initial protests over economic hardship evolved into widespread calls for fundamental regime change.",
    "- The state response involved severe repression, including lethal force, mass arrests, and internet blackouts.",
    "- Protest activity declined by mid-January 2026, but anger, trauma, and distrust toward the regime remain high.",
    "- Online discourse spans anger, grief, cynicism, urgency, fatigue, and cautious hope.",
    "",
    "Use this background ONLY to understand tone/subtext. Do NOT mention specific people/accounts/phrases unless they naturally arise from the user input or provided examples.",
  ].join("\n");
}

/**
 * Stage 1: Generate English comments only.
 * Output schema: {"comments":[{"text":string}]}
 */
export function buildDraftPrompt(input: GenerateInput): AIChatMessage[] {
  const allowed = normalizeHashtags(input.allowed_hashtags);
  const examplesBlock = formatExamples(input);
  const coreContext = buildCoreContext(input);

  const outputRules = [
    "Output format (STRICT):",
    `- Return ONLY valid JSON exactly matching: {"comments":[{"text":string}]}`,
    `- comments.length MUST equal ${input.count}`,
    `- Top-level object MUST have ONLY the key "comments"`,
    "- No wrapper keys (no 'response', 'usage', 'tool_calls')",
    "- No markdown, no code fences, no extra text",
    "- Each text MUST be English",
    "- Each text MUST be a single line (no \\n or \\r)",
    "- Each text MUST be 180-280 characters (hard bounds)",
  ].join("\n");

  const toneDescription = [
    "Tone directive:",
    `- Selected tone: ${input.tone}`,
    `- Writing style: ${describeTone(input.tone)}`,
    "- Tone must be clearly felt in wording, sentence length, and verb choice.",
    "- Do NOT default to neutral activist language unless tone is explicitly 'neutral'.",
  ].join("\n");

  const qualityRules = [
    "Quality rules (VERY IMPORTANT):",
    "- Write like real X/Twitter replies: concise, punchy, human.",
    "- Each comment must feel clearly tied to the specific Title/Description (no generic filler).",
    "- Use at least ONE concrete hook per comment from the input (e.g., a number, claim, quoted phrase, action requested, accusation, outcome, call to action).",
    "- Paraphrase; do NOT copy long phrases from the input verbatim (max 10-word overlap).",
    "- Strong diversity: vary openings, sentence structure, verbs, and pacing.",
    "- Avoid activist-bot boilerplate (e.g., repeating 'must be held accountable' across comments).",
  ].join("\n");

  const antiSpamRules = [
    "Anti-spam / anti-bot constraints:",
    "- NO emojis.",
    "- No numbered lists.",
    "- No ALL CAPS shouting (max 1–2 words if needed).",
    "- At most 2 exclamation marks across all comments total.",
    "- At most 3 questions total across all comments.",
    "- Keep @mentions optional and natural; do NOT force tagging specific accounts unless implied by input/examples.",
  ].join("\n");

  const hashtagRules =
    allowed.length > 0
      ? [
          "Hashtag rules:",
          "- Hashtags are OPTIONAL.",
          "- If used: max 2 hashtags per comment.",
          `- Only choose from this allowed list exactly: ${allowed.join(", ")}`,
          "- Do NOT invent/modify/translate hashtags.",
          "- At least half of the comments should have ZERO hashtags (avoid looking like a bot).",
        ].join("\n")
      : [
          "Hashtag rules:",
          "- Allowed list is empty → ZERO hashtags allowed in any comment.",
        ].join("\n");

  const finalGuard = [
    "Final check before responding:",
    "- If any comment sounds generic, templated, or repetitive → rewrite it to be more specific and human.",
    "- Do not reuse the same opening phrase more than twice.",
  ].join("\n");

  return [
    {
      role: "system",
      content: [
        "You generate realistic English reply comments for social media posts.",
        "Return ONLY valid JSON. No extra text.",
        "",
        coreContext ? coreContext + "\n\n" : "",
        toneDescription,
        outputRules,
        "",
        qualityRules,
        "",
        antiSpamRules,
        "",
        hashtagRules,
        "",
        finalGuard,
      ]
        .filter(Boolean)
        .join("\n"),
    },
    {
      role: "user",
      content: [
        "User inputs (Persian):",
        `- Title (FA): ${String(input.title_fa || "").trim()}`,
        `- Description (FA): ${String(input.description_fa || "").trim()}`,
        `- Need (FA): ${String(input.need_fa || "").trim()}`,
        `- Comment type (FA): ${String(input.comment_type_fa || "").trim()}`,
        `- Tone: ${input.tone}`,
        "",
        `- Stream: ${input.stream}`,
        `- Topic: ${input.topic}`,
        "",
        `Allowed hashtags: ${JSON.stringify(allowed)}`,
        "",
        "Style examples (learn tone/format; examples may contain mentions/hashtags):",
        examplesBlock,
        "",
        `Now generate exactly ${input.count} comments and return JSON only.`,
      ].join("\n"),
    },
  ];
}
