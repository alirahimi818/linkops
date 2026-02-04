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
      return "Morally outraged. Emphasize injustice, shock, and betrayal. Sharp verbs, moral clarity, controlled intensity.";
    case "demanding":
      return "Demanding and assertive. Clear calls for action. No hedging language. Imperatives and accountability framing.";
    case "urgent":
      return "Urgent and time-sensitive. Emphasize consequences of delay. Fast pacing, 'now/today' energy.";
    case "sad":
      return "Grieving and heavy. Focus on loss, pain, and human cost. Human-first language, not slogans.";
    case "hopeful":
      return "Cautiously hopeful. Acknowledge pain but point to possible change. Measured optimism.";
    case "defiant":
      return "Defiant and unyielding. Emphasize resistance and refusal to submit. Strong, steady voice.";
    case "sarcastic":
      return "Dry, sarcastic, biting. Controlled irony, not jokes. Subtle ridicule and contrast.";
    case "calm_firm":
      return "Calm but firm. Serious, controlled, and resolute. No melodrama; clear stance.";
    case "neutral":
    default:
      return "Emotionally neutral but still human. Informative, specific, no strong emotional language.";
  }
}

function buildCoreContext(input: GenerateInput): string {
  // Soft background only for this topic; do not force names/slogans.
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

  // IMPORTANT: keep these bounds aligned with your validator (and downstream UX).
  // 120–220 is typically best for X replies, but the user-provided spec currently says 180–280.
  // If you switch to 120–220, update validator + prompt together.
  const minChars = 120;
  const maxChars = 220;

  const outputRules = [
    "Output format (STRICT):",
    `- Return ONLY valid JSON exactly matching: {"comments":[{"text":string}]}`,
    `- comments.length MUST equal ${input.count}`,
    `- Top-level object MUST have ONLY the key "comments"`,
    "- No wrapper keys (no 'response', 'usage', 'tool_calls')",
    "- No markdown, no code fences, no extra text",
    "- Each text MUST be English",
    "- Each text MUST be a single line (no \\n or \\r)",
    `- Each text MUST be ${minChars}-${maxChars} characters (hard bounds)`,
  ].join("\n");

  const toneDescription = [
    "Tone directive:",
    `- Selected tone: ${input.tone}`,
    `- Writing style: ${describeTone(input.tone)}`,
    "- Tone must be clearly felt in wording, pacing, and verb choice.",
    "- Do NOT default to generic neutral activist language unless tone is explicitly 'neutral'.",
  ].join("\n");

  const rolePerspective = [
    "Role perspective (CRITICAL):",
    "- Write as a real Iranian user active on X in early 2026.",
    "- These are replies, not press releases, not NGO statements, not policy memos.",
    "- Natural, human, sometimes bitter/urgent/grieving depending on tone, but coherent.",
    "- Use the provided examples as the DEFAULT style template.",
    "- Do NOT mention specific people/accounts/phrases unless they naturally arise from the user input or provided examples.",
  ].join("\n");

  const qualityRules = [
    "Quality rules (VERY IMPORTANT):",
    "- Write like real X/Twitter replies: punchy, human, readable.",
    "- Every comment MUST feel tied to the specific Title/Description (no generic filler).",
    "- Each comment MUST include at least ONE concrete hook from the input:",
    "  e.g., a number/range, a quoted phrase, an action requested, a claim/accusation, a stated outcome, or a call to action that fits the prompt.",
    "- Paraphrase; do NOT copy long phrases from the input verbatim (max 10-word overlap).",
    "- Strong diversity: vary openings, sentence structure, verbs, pacing, and emotional angle.",
    "- Avoid activist-bot boilerplate (e.g., repeating 'must be held accountable' across comments).",
    "- If examples show a pattern (mentions/hashtags cadence, rhetoric), follow it unless a rule forbids it.",
  ].join("\n");

  const antiSpamRules = [
    "Anti-spam / anti-bot constraints:",
    "- NO emojis.",
    "- No numbered lists.",
    "- No ALL CAPS shouting (max 1–2 words if needed).",
    "- At most 2 exclamation marks across all comments total.",
    "- At most 3 questions total across all comments.",
    "- Avoid repeated template starts (do not reuse the same opening phrase more than twice).",
    "- Avoid repeating the same key sentence structure across many comments.",
  ].join("\n");

  const mentionAndHashtagGuidance =
    allowed.length > 0
      ? [
          "Hashtag & mention usage (IMPORTANT):",
          "- Follow the STYLE of the provided examples by DEFAULT.",
          "- Hashtags are OPTIONAL but COMMON in this discourse when examples include them.",
          "- If you use hashtags: max 2 per comment, ONLY from the allowed list.",
          "- Across the 10 comments: include hashtags in about 6–8 comments (not all 10).",
          "- Mentions are OPTIONAL but also COMMON when addressing responsibility or action.",
          "- Use mentions only when they naturally fit the content; do NOT force random tagging.",
          "- Do NOT invent/modify/translate hashtags.",
        ].join("\n")
      : [
          "Hashtag & mention usage:",
          "- Allowed hashtag list is empty → ZERO hashtags allowed in any comment.",
          "- Mentions are optional and must be natural; do NOT force tagging.",
        ].join("\n");

  const finalGuard = [
    "Final check before responding:",
    "- If any comment sounds generic, templated, or repetitive → rewrite it to be more specific and human.",
    "- Ensure each comment has a distinct hook and distinct wording.",
    "- Ensure the output is ONLY JSON with key 'comments'.",
  ].join("\n");

  const systemContent = [
    "You generate realistic English reply comments for social media posts.",
    "Return ONLY valid JSON. No extra text.",
    "",
    coreContext ? coreContext : "",
    coreContext ? "" : "",
    toneDescription,
    "",
    rolePerspective,
    "",
    outputRules,
    "",
    qualityRules,
    "",
    antiSpamRules,
    "",
    mentionAndHashtagGuidance,
    "",
    finalGuard,
  ]
    .filter((x) => String(x).trim().length > 0)
    .join("\n");

  const userContent = [
    "User inputs (Persian):",
    `- Title (FA): ${String(input.title_fa || "").trim()}`,
    `- Description (FA): ${String(input.description_fa || "").trim()}`,
    `- Need (FA): ${String(input.need_fa || "").trim()}`,
    `- Comment type (FA): ${String(input.comment_type_fa || "").trim()}`,
    `- Tone: ${String(input.tone || "").trim()}`,
    "",
    `- Stream: ${String(input.stream || "").trim()}`,
    `- Topic: ${String(input.topic || "").trim()}`,
    "",
    `Allowed hashtags: ${JSON.stringify(allowed)}`,
    "",
    "Style examples (learn tone/format; examples may contain mentions/hashtags):",
    examplesBlock,
    "",
    `Now generate exactly ${input.count} comments and return JSON only.`,
  ].join("\n");

  return [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ];
}