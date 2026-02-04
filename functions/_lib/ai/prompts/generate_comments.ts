import type {
  AIChatMessage,
  DraftOutput,
  GenerateInput,
  Tone,
} from "../types";

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

/* ------------------------------ Stage 1 ------------------------------ */
/**
 * Stage 1: Generate English comments only.
 * Output schema:
 * {"comments":[{"text":string}]}
 */
export function buildDraftPrompt(input: GenerateInput): AIChatMessage[] {
  const allowed = normalizeHashtags(input.allowed_hashtags);
  const examplesBlock = formatExamples(input);

  return [
    {
      role: "system",
      content: [
        "You generate short social media reply comments.",
        "Return ONLY valid JSON. No markdown. No extra text.",
        "",
        "Output rules:",
        `- Output must match this JSON schema exactly: {"comments":[{"text":string}]}`,
        `- comments.length MUST equal ${input.count}`,
        "- Each text MUST be English (en).",
        "- Each text MUST be a single line (no line breaks).",
        "- Keep comments natural and non-spammy.",
        "",
        "Hashtag & mention rules:",
        "- You MAY include @mentions if they fit the style (learn from examples).",
        "- If you include hashtags, they MUST be ONLY from the allowed list.",
        "- Do NOT invent new hashtags.",
        "- If allowed list is empty, do NOT include any hashtags.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "User inputs (Persian):",
        `- Title (FA): ${input.title_fa}`,
        `- Description (FA): ${input.description_fa}`,
        `- Need (FA): ${input.need_fa}`,
        `- Comment type (FA): ${input.comment_type_fa}`,
        `- Tone: ${input.tone}`,
        "",
        // These fields are kept for logging/context but do not require special behavior
        `- Stream: ${input.stream}`,
        `- Topic: ${input.topic}`,
        "",
        `Allowed hashtags: ${JSON.stringify(allowed)}`,
        "",
        "Style examples (match tone/format; mentions/hashtags may appear):",
        examplesBlock,
        "",
        `Now generate exactly ${input.count} comments and return JSON only.`,
      ].join("\n"),
    },
  ];
}

/* ------------------------------ Stage 2 ------------------------------ */

export function buildTranslatePrompt(args: {
  draft: DraftOutput;
  tone: Tone;
  stream: "political";
  topic: "iran_revolution_jan_2026";
}): AIChatMessage[] {
  // Provide the draft as structured JSON to prevent accidental edits
  const draftPayload = {
    comments: args.draft.comments.map((c) => ({ text: c.text })),
  };

  return [
    {
      role: "system",
      content: [
        "You translate English comments to Persian (fa).",
        "Return ONLY valid JSON. No markdown. No extra text.",
        "",
        "CRITICAL rules:",
        `- Output schema MUST be exactly: {"comments":[{"text":string,"translation_text":string}]}`,
        `- comments.length MUST equal ${args.draft.comments.length}`,
        "- Each text MUST be EXACTLY identical to the input text (no edits, no reformatting).",
        "- translation_text MUST be Persian and single-line (no line breaks).",
        "- Do NOT translate, change, remove, or alter ANY hashtags (#...) or mentions (@...). They must remain exactly the same in translation_text.",
        "- Keep punctuation natural in Persian, but do not alter hashtags/mentions.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Tone: ${args.tone}`,
        `Stream: ${args.stream}`,
        `Topic: ${args.topic}`,
        "",
        "Translate the following JSON input. Keep 'text' unchanged and add 'translation_text' for each item.",
        "INPUT_JSON:",
        JSON.stringify(draftPayload),
        "",
        "Return JSON only.",
      ].join("\n"),
    },
  ];
}