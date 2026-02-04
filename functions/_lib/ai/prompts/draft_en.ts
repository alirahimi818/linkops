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
      return "Demanding and assertive. Imperatives. Clear asks. No hedging.";
    case "urgent":
      return "Urgent and time-sensitive. Pressure now. Emphasize consequences of delay.";
    case "sad":
      return "Grieving and heavy. Human cost, loss, pain. No slogans.";
    case "hopeful":
      return "Cautiously hopeful. Acknowledge pain, point to possible change.";
    case "defiant":
      return "Defiant and unyielding. Refusal to submit. Strong spine, steady voice.";
    case "sarcastic":
      return "Dry, biting sarcasm. Controlled irony. Not jokes, not memes.";
    case "calm_firm":
      return "Calm but firm. Serious, controlled, resolute. Minimal emotion words, maximum clarity.";
    case "neutral":
    default:
      return "Neutral but human. Specific, not emotional. Avoid moral grandstanding.";
  }
}

function buildCoreContext(input: GenerateInput): string {
  if (input.stream !== "political" || input.topic !== "iran_revolution_jan_2026")
    return "";

  return [
    "Background context for Iran-related political content (subtext only; do NOT quote; do NOT force names/slogans):",
    "- In early 2026, Iran faced intense unrest after protests beginning late Dec 2025.",
    "- Calls expanded into fundamental regime change.",
    "- State response included lethal force, arrests, and internet blackouts.",
    "- Protests declined by mid-Jan 2026, but anger/trauma/distrust remain high.",
    "- Online discourse spans anger, grief, cynicism, urgency, fatigue, cautious hope.",
    "",
    "Use this only to write naturally. Do NOT inject specific people/accounts/phrases unless they appear in user input or examples.",
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
  const minChars = 130; // slightly higher than before to reduce "too short" fails
  const maxChars = 220;

  // Hashtags: match examples but avoid botty "all have hashtags"
  const hashtagsWithCount = allowed.length > 0 ? Math.min(6, count) : 0; // exactly 6 by default
  const hashtagsZeroCount = count - hashtagsWithCount;

  const system = [
    "You generate realistic English reply comments for social media posts.",
    "Return ONLY valid JSON. No extra text.",
    "",
    coreContext ? coreContext : "",
    "",
    "Tone directive:",
    `- Selected tone: ${input.tone}`,
    `- Writing style: ${describeTone(input.tone)}`,
    "- Tone must be clearly felt in wording, pacing, and verb choice.",
    "- Avoid generic NGO/press-release wording. These are X/Twitter replies by a real person.",
    "",
    "Style to imitate:",
    "- Use the examples as the default template: short punch + optional em dash (—) clause + direct ask/call.",
    "- Sound like a real Iranian user writing in English in early 2026: human, reactive, not polished.",
    "",
    "Output format (STRICT):",
    `- Return ONLY valid JSON exactly matching: {"comments":[{"text":string}]}`,
    `- comments.length MUST equal ${count}`,
    '- Top-level object MUST have ONLY the key "comments"',
    "- ABSOLUTELY NO wrapper keys (no 'response', 'usage', 'tool_calls', etc.)",
    "- No markdown, no code fences, no extra text",
    "- Each text MUST be English",
    "- Each text MUST be a single line (no \\n or \\r)",
    `- Each text MUST be ${minChars}-${maxChars} characters (hard bounds)`,
    "",
    "Quality rules (VERY IMPORTANT):",
    "- Every comment MUST feel tied to the Title/Description (no generic filler).",
    "- Every comment MUST include at least ONE concrete hook from the input.",
    "- Spread hooks across comments; do not repeat the same hook in many items.",
    "- Paraphrase; do NOT copy long phrases verbatim (max 10-word overlap).",
    "- Strong diversity: vary openings, structure, verbs, and emotional angle.",
    "",
    "Hook coverage plan (FOLLOW):",
    "- At least 3 comments must reference the poll action (YES vote, poll, or 'comment with photo').",
    "- At least 3 comments must reference the casualty range (36,500–50,000 or 'tens of thousands').",
    "- At least 2 comments must reference the 'help is on its way' promise / broken promises.",
    "- If 'no negotiations/no deal' is mentioned in input/examples, include it in 2–3 comments max (not all).",
    "",
    "Mentions policy (IMPORTANT):",
    "- Mentions are OPTIONAL. Do NOT force them.",
    "- Use mentions in ONLY 2–4 comments total, and only if naturally relevant (prefer ones present in input/examples).",
    "- Never exceed 2 mentions in a comment.",
    "- Do NOT introduce random accounts not in input/examples.",
    "",
    "Hashtag policy (IMPORTANT):",
    "- Hashtags are common in examples but should not appear everywhere.",
    allowed.length > 0
      ? `- Exactly ${hashtagsWithCount} comments MUST include 1–2 hashtags (ONLY from allowed list); exactly ${hashtagsZeroCount} comments MUST include ZERO hashtags.`
      : "- Allowed list is empty → ZERO hashtags allowed.",
    "- Never exceed 2 hashtags per comment.",
    "- Do NOT invent/modify/translate hashtags.",
    "",
    "Anti-bot constraints:",
    "- NO emojis.",
    "- No numbered lists.",
    "- No ALL CAPS shouting (max 1–2 words if needed).",
    "- Across all comments total: max 2 exclamation marks.",
    "- Across all comments total: max 3 questions.",
    "- Do not reuse the same opening phrase more than twice.",
    "- Avoid boilerplate like 'must be held accountable' (max once).",
    "",
    "Final silent self-check (do NOT output this checklist):",
    "- JSON only, no wrapper keys.",
    `- Exactly ${count} items.`,
    `- Each text ${minChars}-${maxChars} chars and single line.`,
    `- Hashtag distribution correct (${hashtagsWithCount} with hashtags / ${hashtagsZeroCount} without).`,
    "- Mentions appear in only 2–4 items max.",
    "- Hook coverage satisfied and hooks are diverse.",
  ]
    .filter((x) => String(x).trim().length > 0)
    .join("\n");

  const user = [
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
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
