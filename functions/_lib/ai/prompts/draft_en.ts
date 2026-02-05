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
    "- Early 2026 Iran discourse: anger, grief, distrust, urgency; people demand real action.",
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

  // Soft targets: avoids "zero hashtag" behavior without forcing all comments.
  const minHashtagComments = Math.min(4, count); // e.g., 4 of 10 include hashtags
  const minMentionComments = Math.min(2, count); // e.g., 2 of 10 include mentions

  const system = [
    "You write realistic English reply comments for X/Twitter posts.",
    'Return ONLY valid JSON exactly: {"comments":[{"text":"..."}]} with NO extra keys.',
    "",
    coreContext ? coreContext : "",
    "",
    `Tone: ${input.tone}`,
    `Style: ${describeTone(input.tone)}`,
    "",
    "Rules:",
    `- Generate exactly ${count} comments.`,
    `- Each comment: one line, English only, ${minChars}-${maxChars} characters.`,
    "- Each comment must reference at least ONE concrete detail from the post (title/description).",
    "- Keep the same stance across all comments, but avoid spam: do NOT reuse the same opening (first ~8 words) more than once.",
    "- Write like a real person: punchy opening + optional em dash (—) + direct ask/action.",
    "- No emojis. No markdown.",
    "",
    "Mentions/hashtags (IMPORTANT):",
    "- Use them like real X replies: not in every comment, but not zero either.",
    `- Across the ${count} comments: at least ${minHashtagComments} comments MUST include 1–2 hashtags from the allowed list.`,
    `- Across the ${count} comments: at least ${minMentionComments} comments MUST include 1 mention IF mentions appear in the examples/input; otherwise use 0 mentions.`,
    "- Prefer hashtags and mentions that appear in the examples when relevant.",
    "- Max per comment: 2 hashtags, 2 mentions.",
    "- Do NOT invent new hashtags or mentions.",
  ]
    .filter((x) => String(x).trim().length > 0)
    .join("\n");

  const titleFa = String(input.title_fa || "").trim();
  const descFa = String(input.description_fa || "").trim();

  // Provide a short prioritized subset to make selection easier for the model.
  const preferredHashtags = allowed.slice(0, 8);

  const user = [
    "Post inputs (FA):",
    `Title: ${titleFa}`,
    `Description: ${descFa}`,
    `Need: ${String(input.need_fa || "").trim()}`,
    `Comment type: ${String(input.comment_type_fa || "").trim()}`,
    `Tone: ${String(input.tone || "").trim()}`,
    "",
    "One-line post summary (EN): Reply to the post above. React to its main claim and push your stance clearly.",
    "",
    `Allowed hashtags (ASCII only): ${JSON.stringify(allowed)}`,
    `Preferred picks (use these first if relevant): ${JSON.stringify(preferredHashtags)}`,
    "",
    "Examples to imitate (rhythm/tone only):",
    examplesBlock,
    "",
    `Now generate ${count} comments and return JSON only.`,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}