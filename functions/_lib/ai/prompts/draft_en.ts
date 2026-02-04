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

function describeTone(tone: string): string {
  switch (tone) {
    case "angry":
      return "Angry, raw, confrontational. Short punches. Direct blame. No politeness.";
    case "outraged":
      return "Morally outraged. Injustice, shock, betrayal. Sharp verbs, moral clarity, controlled intensity.";
    case "demanding":
      return "Demanding and assertive. Clear asks. Imperatives. No hedging.";
    case "urgent":
      return "Urgent and time-sensitive. Pressure now. Consequences of delay.";
    case "sad":
      return "Grieving and heavy. Human cost. Loss, pain, names/numbers. No slogans.";
    case "hopeful":
      return "Cautiously hopeful. Acknowledge pain but point to possible change.";
    case "defiant":
      return "Defiant and unyielding. Refusal to submit. Strong spine, steady voice.";
    case "sarcastic":
      return "Dry, biting sarcasm. Controlled irony. Not jokes, not memes.";
    case "calm_firm":
      return "Calm but firm. Serious, controlled, resolute. Minimal emotion words, maximum clarity.";
    case "neutral":
    default:
      return "Neutral but human. Specific, not emotional. No heavy moral language.";
  }
}

function buildCoreContext(input: GenerateInput): string {
  if (
    input.stream !== "political" ||
    input.topic !== "iran_revolution_jan_2026"
  ) {
    return "";
  }

  return [
    "Background context for Iran-related political content (use ONLY for subtext; do NOT quote; do NOT force names/slogans):",
    "- In early 2026, Iran has faced intense nationwide unrest after major protests starting late Dec 2025.",
    "- Protests expanded into calls for fundamental regime change.",
    "- State response included lethal force, mass arrests, and internet blackouts.",
    "- Protest activity declined by mid-Jan 2026, but anger/trauma/distrust remain.",
    "- Online discourse includes anger, grief, cynicism, urgency, fatigue, cautious hope.",
    "",
    "Do NOT mention specific people/accounts/phrases unless they naturally arise from the user input or provided examples.",
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

  const count = input.count;

  // Keep aligned with validator
  const minChars = 120;
  const maxChars = 220;

  // Distribution plan to avoid botty outputs but still match example vibe
  const hashtagTarget = allowed.length > 0 ? Math.min(7, count) : 0; // aim 6–8; use 7 by default
  const mentionTarget = Math.min(6, count); // mentions are common in examples but not in all items

  const outputRules = [
    "Output format (STRICT):",
    `- Return ONLY valid JSON exactly matching: {"comments":[{"text":string}]}`,
    `- comments.length MUST equal ${count}`,
    `- Top-level object MUST have ONLY the key "comments"`,
    "- ABSOLUTELY NO wrapper keys (no 'response', 'usage', 'tool_calls', etc.)",
    "- No markdown, no code fences, no extra text",
    "- Each text MUST be English",
    "- Each text MUST be a single line (no \\n or \\r)",
    `- Each text MUST be ${minChars}-${maxChars} characters (hard bounds)`,
  ].join("\n");

  const toneBlock = [
    "Tone directive:",
    `- Selected tone: ${input.tone}`,
    `- Writing style: ${describeTone(input.tone)}`,
    "- Tone must be clearly felt in verb choice, pacing, and moral framing.",
    "- Do NOT default to generic NGO/activist boilerplate unless tone is neutral.",
  ].join("\n");

  const styleBlock = [
    "Style to imitate (IMPORTANT):",
    "- Copy the RHYTHM of the examples: short punch + em dash (—) clause + direct ask/call.",
    "- Use '—' naturally when it helps (not required every time).",
    "- Replies should sound like a real person reacting to THIS post, not a template.",
  ].join("\n");

  const specificityRules = [
    "Specificity rules (VERY IMPORTANT):",
    "- Every comment MUST include at least ONE concrete hook from Title/Description:",
    "  examples of hooks: the poll, 'YES' instruction, 'comment with photo', the quoted question, the number range 36,500–50,000, 'help is on its way', 'no negotiations', demands for real action/recognition.",
    "- Paraphrase; do NOT copy long phrases verbatim (max 10-word overlap).",
    "- Avoid repeating the same hook across many comments; spread hooks across items.",
  ].join("\n");

  const antiBotRules = [
    "Anti-bot rules (STRICT):",
    "- NO emojis.",
    "- No numbered lists.",
    "- No ALL CAPS shouting (max 1–2 words if needed).",
    "- Across all comments total: max 2 exclamation marks.",
    "- Across all comments total: max 3 questions.",
    "- Do not reuse the same opening phrase more than twice.",
    "- Avoid repeating the same structure (e.g., 'Yes, ...' in many items). Mix openings.",
    "- Avoid bland filler like 'must be held accountable' (max once).",
  ].join("\n");

  const distributionRules =
    allowed.length > 0
      ? [
          "Hashtag & mention distribution plan (FOLLOW EXACTLY):",
          `- Exactly ${hashtagTarget} comments MUST include 1–2 hashtags (ONLY from allowed list).`,
          `- The remaining ${count - hashtagTarget} comments MUST include ZERO hashtags.`,
          `- Exactly ${mentionTarget} comments MUST include 1–2 @mentions (only if natural; prefer ones appearing in input/examples).`,
          `- The remaining ${count - mentionTarget} comments MUST include ZERO @mentions.`,
          "- Never exceed 2 hashtags per comment.",
          "- Never exceed 2 mentions per comment.",
          "- Do NOT invent/modify/translate hashtags.",
        ].join("\n")
      : [
          "Hashtag & mention rules:",
          "- Allowed hashtag list is empty → ZERO hashtags allowed in any comment.",
          `- Exactly ${mentionTarget} comments MUST include 1–2 @mentions (only if natural; prefer ones in input/examples).`,
          `- The remaining ${count - mentionTarget} comments MUST include ZERO @mentions.`,
        ].join("\n");

  const finalGuard = [
    "Final silent self-check (do NOT output this checklist):",
    "- Count correct? JSON only? No wrapper keys?",
    `- Each text ${minChars}-${maxChars} chars and single-line?`,
    `- Exactly ${hashtagTarget} with hashtags and ${count - hashtagTarget} without? (if hashtags allowed)`,
    `- Exactly ${mentionTarget} with mentions and ${count - mentionTarget} without?`,
    "- Each comment has a different hook and feels human, not templated?",
  ].join("\n");

  return [
    {
      role: "system",
      content: [
        "You generate realistic English reply comments for social media posts.",
        "Return ONLY valid JSON. No extra text.",
        "",
        coreContext ? coreContext : "",
        coreContext ? "" : "",
        toneBlock,
        "",
        styleBlock,
        "",
        outputRules,
        "",
        specificityRules,
        "",
        antiBotRules,
        "",
        distributionRules,
        "",
        finalGuard,
      ]
        .filter((x) => String(x).trim().length > 0)
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
        `Now generate exactly ${count} comments and return JSON only.`,
      ].join("\n"),
    },
  ];
}
