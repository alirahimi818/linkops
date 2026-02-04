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
    "Use this only to sound natural. Do NOT inject specific people/accounts/phrases unless they appear in the user input or examples.",
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
  const minChars = 130;
  const maxChars = 220;

  // Hashtags distribution: match example-y discourse but avoid botty "all have hashtags"
  const hashtagsWithCount = allowed.length > 0 ? Math.min(7, count) : 0;
  const hashtagsZeroCount = count - hashtagsWithCount;

  const system = [
    "You generate realistic English reply comments for Iran-related political posts (X/Twitter style).",
    "Return ONLY valid JSON. No extra text.",
    "",
    coreContext ? coreContext : "",
    "",
    "Tone directive:",
    `- Selected tone: ${input.tone}`,
    `- Writing style: ${describeTone(input.tone)}`,
    "- Tone must be clearly felt in verb choice, pacing, and moral framing.",
    "- Avoid NGO/press-release/policy memo tone. These are replies by a real person.",
    "",
    "Style to imitate (IMPORTANT):",
    "- Use the examples as the default template: short punch + optional em dash (—) clause + direct ask/call.",
    "- Human, reactive, not polished. Controlled intensity when outraged/angry.",
    "- Do NOT force any person/account/slogan unless it appears in the user input or examples.",
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
    "Specificity rules (VERY IMPORTANT):",
    "- Every comment MUST clearly tie to the Title/Description/Need (no generic filler).",
    "- Every comment MUST include at least ONE concrete hook extracted from the input.",
    "- Hooks can be: numbers/ranges, a quoted phrase, the post format (poll), the requested action, a claim/accusation, a promise, a consequence, or a concrete demand.",
    "- Spread hooks across comments; do not repeat the same hook in many items.",
    "- Paraphrase; do NOT copy long phrases verbatim (max 10-word overlap).",
    "",
    "Diversity plan (FOLLOW):",
    "- Write 10 comments with 10 different 'angles'. Each comment must pick ONE primary angle below:",
    "  1) Call to action (do X now).",
    "  2) Moral indictment (betrayal/shame).",
    "  3) Grief/human cost (names/numbers/loss).",
    "  4) Cynical realism (they won't act unless pressured).",
    "  5) Urgency/time (delay kills).",
    "  6) Direct rebuttal to a claim in the post.",
    "  7) Accountability demand (target institutions/decision-makers if present in input/examples).",
    "  8) Tactical suggestion (what to do: vote/reshare/photo/keep pressure).",
    "  9) Short sharp one-liner (still must include a hook).",
    "  10) Conditional threat framing (no deals unless X, only if relevant to input).",
    "- Do not reuse the same opening phrase more than twice.",
    "- Avoid repeating the same core sentence shape across many items (mix fragments, questions, imperatives, clauses).",
    "",
    "Anti-bot constraints:",
    "- NO emojis.",
    "- No numbered lists in outputs.",
    "- No ALL CAPS shouting (max 1–2 words if needed).",
    "- Across all comments total: max 2 exclamation marks.",
    "- Across all comments total: max 3 questions.",
    "- Avoid boilerplate like 'must be held accountable' (max once).",
    "",
    "Mentions (@) policy:",
    "- Mentions are OPTIONAL. Use them only when naturally relevant.",
    "- Use mentions in ONLY 2–4 comments total.",
    "- Use ONLY accounts that appear in the user input or examples. Never invent new accounts.",
    "- Never exceed 2 mentions in a comment.",
    "",
    "Hashtag policy:",
    allowed.length > 0
      ? `- Exactly ${hashtagsWithCount} comments MUST include 1–2 hashtags (ONLY from allowed list); exactly ${hashtagsZeroCount} comments MUST include ZERO hashtags.`
      : "- Allowed list is empty → ZERO hashtags allowed.",
    "- Never exceed 2 hashtags per comment.",
    "- Do NOT invent/modify/translate hashtags.",
    "",
    "Anti-repetition on key political asks (IMPORTANT):",
    "- Do NOT repeat the same political ask in most comments.",
    "- If a leadership recognition demand exists in the input/examples, use it in AT MOST 3 comments total.",
    "- If 'no negotiations/no deal' exists in the input/examples, use it in AT MOST 3 comments total.",
    "- Use varied verbs (back, recognize, engage, stop stalling, deliver support, cut deals, etc.).",
    "",
    "Final silent self-check (do NOT output this checklist):",
    "- JSON only; top-level key 'comments' only; no wrapper keys.",
    `- Exactly ${count} items; each ${minChars}-${maxChars} chars; single line.`,
    `- Hashtag distribution correct (${hashtagsWithCount} with hashtags / ${hashtagsZeroCount} without).`,
    "- Mentions appear in only 2–4 items total.",
    "- Each comment has a distinct hook + distinct angle.",
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
