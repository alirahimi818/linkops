// prompts/draft_en.ts

import type { GenerateInput } from "../types";

function safeList(xs: string[] | undefined, limit: number) {
  return Array.isArray(xs) ? xs.slice(0, limit) : [];
}

export function buildDraftPrompt(input: GenerateInput) {
  const allowed = safeList(input.allowed_hashtags, 80);
  const preferred = safeList((input as any).preferred_hashtags, 20);
  const count = Number(input.count || 10);

  const titleFa = String(input.title_fa || "").trim();
  const descFa = String(input.description_fa || "").trim();
  const needFa = String(input.need_fa || "").trim();

  const tone = String(input.tone || "neutral");
  const commentType = String(input.comment_type_fa || "Reply").trim();

  const rules = [
    "You write realistic English reply comments for an X/Twitter post.",
    "",
    "OUTPUT FORMAT (very important):",
    "- Output plain text ONLY.",
    "- One comment per line.",
    "- No numbering (no '1.', no '-', no '*', no bullets).",
    "- No quotes around lines.",
    "- No JSON. No markdown. No code fences.",
    "- No emojis.",
    "- Do not add headings or explanations before/after the lines.",
    "",
    "QUANTITY:",
    `- Aim for ~${count} lines.`,
    "- Minimum 5 lines is acceptable.",
    "- If you can produce more, cap at 15 lines.",
    "- If you are unsure, write fewer lines but keep them realistic and grounded.",
    "",
    "STYLE:",
    `- Tone: ${tone}.`,
    "- Write like a real person replying on X: direct, specific, not generic.",
    "- Avoid repeating the same opener across many lines.",
    "- Each line must be a SINGLE LINE (no line breaks).",
    "- Keep each comment around 120-260 characters.",
    "",
    "GROUNDING:",
    "- Every comment must reference a concrete detail from the post context (a claim, a phrase, or the linked announcement).",
    "- Do NOT invent facts beyond what is in the post context.",
    "- Do NOT quote long parts of the post. Paraphrase naturally.",
    "- Avoid adding extra URLs unless the post context explicitly contains them and it's necessary.",
    "",
    "HASHTAGS / MENTIONS:",
    "- Hashtags are optional: use 0-2 hashtags in some lines when it feels natural.",
    "- Only use hashtags from the allowed list (exact match).",
    "- Prefer using the preferred hashtags if relevant.",
    "- Mentions are optional: only use mentions that appear in the post context/examples.",
    "",
    "Preferred hashtags (use first when relevant):",
    preferred.length ? preferred.join(" ") : "(none)",
    "",
    "Allowed hashtags (exact tokens, ASCII only):",
    allowed.join(" "),
  ].join("\n");

  const userPayload = [
    "Post context:",
    `Title (FA): ${titleFa || "(empty)"}`,
    `Description (FA): ${descFa || "(empty)"}`,
    `Need (FA): ${needFa || "(empty)"}`,
    `Comment type (FA): ${commentType}`,
    "",
    "If examples appear inside the description, imitate their vibe but do NOT copy any line verbatim.",
    "",
    "Now output the comments, one per line (plain text only).",
  ].join("\n");

  return [
    { role: "system", content: rules },
    { role: "user", content: userPayload },
  ];
}