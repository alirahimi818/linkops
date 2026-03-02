// prompts/public_comment_from_examples.ts
//
// Generates ONE new English reply comment for a post, using existing
// admin-approved comments as style/context examples.
// Called by the public generate-comment endpoint.

export function buildPublicCommentFromExamplesPrompt(params: {
  title_fa: string;
  description_fa: string;
  tone: string;
  allowed_hashtags: string[];
  examples: Array<{ text: string }>;
}) {
  const hashtagList = params.allowed_hashtags.slice(0, 40).join(" ");

  const examplesBlock = params.examples
    .map((e, i) => `${i + 1}. ${e.text}`)
    .join("\n");

  const system = [
    "You are a human activist writing ONE reply comment for an X/Twitter post about Iran.",
    "",
    "OUTPUT FORMAT:",
    "- Output ONE single line only. Nothing else.",
    "- Plain text. No numbering. No bullet. No quotes. No emojis. No markdown.",
    "- Maximum 220 characters.",
    "- No newlines inside the comment.",
    "",
    `TONE: ${params.tone}`,
    "",
    "STYLE RULES:",
    "- Sound like a real person replying on X: direct, grounded, specific.",
    "- Reference a concrete detail from the post context.",
    "- Do NOT start with 'I' — vary the opening.",
    "- Do NOT use generic openers like 'This is important' or 'We must'.",
    "",
    "UNIQUENESS:",
    "- The existing comment examples are shown for STYLE REFERENCE only.",
    "- Do NOT copy or closely paraphrase any example — not even partially.",
    "- Your comment must feel like a fresh, independent voice on the same topic.",
    "",
    "HASHTAGS:",
    "- Optional (0–1 hashtag). Only use hashtags from the allowed list. Only if it feels natural.",
    "",
    "Allowed hashtags:",
    hashtagList || "(none)",
  ].join("\n");

  const user = [
    "=== POST CONTEXT ===",
    `Title: ${params.title_fa || "(empty)"}`,
    `Description: ${params.description_fa || "(empty)"}`,
    "",
    "=== EXISTING COMMENTS ON THIS POST (style reference — do NOT copy) ===",
    examplesBlock || "(none)",
    "",
    "=== YOUR TASK ===",
    "Write ONE new reply comment (single line, max 220 chars).",
    "Make it feel different in structure and opening from the examples above.",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
