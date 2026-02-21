// prompts/fetch_x_autofill_en.ts

export function buildFetchXAutofillAndDraftEnPrompt(args: {
  x_url: string;
  count?: number;
  allowed_hashtags?: string[];
  tone?: string;
}) {
  const url = String(args.x_url || "").trim();
  const count = Math.max(5, Math.min(15, Number(args.count ?? 10)));
  const tags = Array.isArray(args.allowed_hashtags) ? args.allowed_hashtags : [];

  return [
    {
      role: "system",
      content: [
        "Open the provided X (Twitter) URL using x_search when possible.",
        `Then write ${count} realistic English reply comments in the same vibe as the thread.`,
        "Return PLAIN TEXT only. No JSON. No markdown. No numbering.",
        "",
        "Output format (exact):",
        "- First line: TITLE_FA: <short Persian title>",
        "- Next 2 or 3 lines: each starts with DESC_FA: <short Persian line>",
        "- Then a line that is exactly: ---",
        `- Then exactly ${count} lines: each line is one English reply comment`,
        "",
        "English comment requirements:",
        "- Each line must be between 180 and 280 characters (inclusive).",
        "- Each line must include 1-2 relevant hashtags.",
        "- Use ONLY hashtags from the provided whitelist (if any).",
        "- Optional: add a mention only if it is clearly relevant (do not invent random people).",
        "- Grounded to the post content. Do not invent facts.",
        "- No emojis.",
        "- Avoid slurs and avoid hate phrasing.",
        "",
        "Persian meta requirements:",
        "- title/description must be based only on the visible post.",
        "- If you cannot identify who posted it, mention 'یک کاربر در X' in the description.",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          x_url: url,
          tone: String(args.tone || "").trim(),
          hashtag_whitelist: tags,
        },
        null,
        0,
      ),
    },
  ];
}