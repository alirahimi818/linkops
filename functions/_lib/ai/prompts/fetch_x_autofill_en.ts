// prompts/fetch_x_autofill_en.ts

export function buildFetchXAutofillAndDraftEnPrompt(args: {
  x_url: string;
  count?: number;
  tone?: string;
  stream?: string;
  topic?: string;
  allowed_hashtags?: string[];
}) {
  const url = String(args.x_url || "").trim();
  const count = Math.max(5, Math.min(15, Number(args.count ?? 10)));
  const tags = Array.isArray(args.allowed_hashtags) ? args.allowed_hashtags : [];

  return [
    {
      role: "system",
      content: [
        "Open the provided X (Twitter) URL using x_search when possible.",
        "Read the main post AND skim several replies to understand the thread vibe.",
        "",
        "Return PLAIN TEXT only. No JSON. No markdown. No numbering.",
        "",
        "Output format (exact):",
        "- First line: TITLE_FA: <short Persian title>",
        "- Next 2 or 3 lines: each starts with DESC_FA: <short Persian line>",
        "- Then a line that is exactly: ---",
        `- Then exactly ${count} lines: each line is one English reply comment`,
        "",
        "Persian title/description requirements:",
        "- Write a meaningful Persian title (not too short).",
        "- Description must be 2-3 lines, each line a complete sentence.",
        "- Include: who posted (name/handle if visible) + what the post claims + one brief hint about the thread vibe (from replies).",
        "- Do not invent facts; only use what you can read on the page.",
        "",
        "English reply requirements:",
        "- Each line must be 180-280 characters (inclusive).",
        "- Each line must include 1-2 relevant hashtags.",
        "- Use ONLY hashtags from the whitelist (if provided).",
        "- Mentions are allowed ONLY if clearly relevant to the post/thread (do not invent random handles).",
        "- Mirror the dominant vibe of the replies (supportive/angry/sarcastic/etc.) while staying grounded to the post.",
        "- No emojis.",
        "- Avoid hate/slurs.",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          x_url: url,
          stream: args.stream ?? "political",
          topic: args.topic ?? "iran_revolution_jan_2026",
          tone: args.tone ?? "demanding",
          hashtag_whitelist: tags,
        },
        null,
        0,
      ),
    },
  ];
}