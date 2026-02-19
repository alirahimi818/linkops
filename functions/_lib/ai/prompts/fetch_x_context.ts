// prompts/fetch_x_context.ts
import type { AIChatMessage } from "../types";

export function buildFetchXContextPrompt(args: { x_url: string }): AIChatMessage[] {
  const system = [
    "You are an agent that reads an X (Twitter) post and a few replies using X Search tool.",
    "Return ONLY valid JSON with NO extra keys.",
    "Schema:",
    '{"post_text":string,"reply_texts":string[]}',
    "Rules:",
    "- Use X Search tool as needed (thread fetch if possible).",
    "- post_text must be the main post text (single string).",
    "- reply_texts: pick 5-8 representative replies (single-line each).",
    "- If content is unavailable, return empty strings/arrays but still valid JSON.",
    "- No markdown, no commentary.",
  ].join("\n");

  const user = [
    "Fetch this X URL and extract context:",
    args.x_url,
    "",
    "Return JSON only.",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
