// prompts/fetch_x_autofill_en.ts

export function buildFetchXAutofillAndDraftEnPrompt(args: {
  x_url: string;
  count?: number;
}) {
  const url = String(args.x_url || "").trim();
  const count = Math.max(5, Math.min(15, Number(args.count ?? 10)));

  return [
    {
      role: "system",
      content: [
        "Open the provided X (Twitter) URL using x_search when possible.",
        "Then write realistic English reply comments in the same vibe as the thread.",
        "Return PLAIN TEXT only. No JSON. No markdown. No numbering.",
        "",
        "Output format (exact):",
        "- First line: TITLE_FA: <a short Persian title>",
        "- Next 2 or 3 lines: each starts with DESC_FA: <a short Persian line>",
        "- Then a line that is exactly: ---",
        `- Then ${count} lines: each line is one English reply comment`,
        "",
        "Rules:",
        "- English comments must be grounded to the post content. Do not invent facts.",
        "- Persian title/description must be based only on the visible post text.",
        "- If you cannot identify who posted it, mention 'یک کاربر در X' in the description.",
        "- Keep hashtags/mentions as-is if you use them.",
        "- No emojis.",
      ].join("\n"),
    },
    {
      role: "user",
      content: `X URL: ${url}`,
    },
  ];
}