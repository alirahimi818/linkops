import type { AIChatMessage, GenerateInput } from "../types";

function isAsciiHashtag(tag: string): boolean {
  return /^#[A-Za-z0-9_]+$/.test(tag);
}

function normalizeHashtagsStage1(tags: string[]): string[] {
  return (tags || [])
    .map((t) => String(t).trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`))
    .filter(isAsciiHashtag);
}

function formatExamples(input: GenerateInput): string {
  const examples = (input.examples?.slice(0, 6) ?? []).filter((e) =>
    String(e?.text || "").trim(),
  );
  if (examples.length === 0) return "No examples provided.";
  return examples
    .map((e, i) => `Example ${i + 1}: ${String(e.text || "").trim()}`)
    .join("\n");
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
    "Background context (subtext only; do NOT quote; do NOT force names/slogans):",
    "- Early 2026 Iran discourse: anger, grief, distrust, urgency, fatigue; calls for real action.",
    "- State violence, arrests, internet disruptions were widely discussed.",
    "Use this only to sound natural. Do NOT inject specific names/phrases unless present in input/examples.",
  ].join("\n");
}

/**
 * Stage 1: Generate English comments only.
 * Output schema: {"comments":[{"text":string}]}
 */
export function buildDraftPrompt(input: GenerateInput): AIChatMessage[] {
  const allowed = normalizeHashtagsStage1(input.allowed_hashtags);
  const examplesBlock = formatExamples(input);
  const coreContext = buildCoreContext(input);

  const count = input.count;
  const minChars = 180;
  const maxChars = 280;

  const system = [
    "You write realistic English reply comments for X/Twitter posts.",
    "Return ONLY valid JSON. No extra keys, no extra text.",
    "",
    coreContext ? coreContext : "",
    "",
    `Tone: ${input.tone}`,
    `Style: ${describeTone(input.tone)}`,
    "",
    "Hard requirements:",
    `- Output JSON only: {"comments":[{"text":string}]}`,
    `- comments.length = ${count}`,
    '- Top-level keys: ONLY "comments"',
    "- Each comment is ONE line (no \\n).",
    `- Each comment is ${minChars}-${maxChars} characters.`,
    "- English only (no Arabic/Persian script).",
    "",
    "Quality requirements (most important):",
    "- Each comment must clearly react to THIS post: reference at least one concrete detail from the Title/Description (e.g., vote YES, poll, casualty numbers, broken promises, blackouts, no-deal, photo in replies) if present.",
    "- Write like a real person: punchy opening + optional em dash (—) + direct ask/action.",
    "- Avoid NGO/press-release phrases. Avoid generic filler.",
    "- Strong variety: different openings, verbs, and angles across comments.",
    "",
    "Mentions/hashtags:",
    "- Optional. Use only if it fits naturally.",
    "- If you use hashtags, pick from the allowed list only, max 1–2.",
    "- Do not invent hashtags.",
  ]
    .filter((x) => String(x).trim().length > 0)
    .join("\n");

  const user = [
    "Post inputs (FA):",
    `Title: ${String(input.title_fa || "").trim()}`,
    `Description: ${String(input.description_fa || "").trim()}`,
    `Need: ${String(input.need_fa || "").trim()}`,
    `Comment type: ${String(input.comment_type_fa || "").trim()}`,
    "",
    `Allowed hashtags (ASCII only): ${JSON.stringify(allowed)}`,
    "",
    "Examples to imitate (rhythm/tone only):",
    examplesBlock,
    "",
    `Generate exactly ${count} comments now. Return JSON only.`,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
