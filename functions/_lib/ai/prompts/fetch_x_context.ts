// prompts/fetch_x_context.ts

export function buildFetchXContextPrompt(args: { x_url: string }) {
  const url = String(args.x_url || "").trim();

  return [
    {
      role: "system",
      content: [
        "You are an assistant that extracts context from an X (Twitter) URL using the x_search tool when possible.",
        "Return ONLY valid JSON with NO extra keys.",
        'Schema: {"post_text":string,"reply_texts":string[]}',
        "Rules:",
        "- Prefer using x_search to open the provided URL and read the main post text.",
        "- If accessible, also collect 5-12 short representative replies (single-line each).",
        "- If replies are not accessible, return reply_texts as an empty array.",
        "- post_text should be plain text (no URLs unless they are essential).",
        "- Each reply_text must be a single line (replace newlines with spaces).",
        "- Never include markdown or commentary.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `X URL: ${url}`,
        "",
        "Task:",
        "1) Extract the main post text.",
        "2) Extract a handful of replies if available.",
        "",
        "Return JSON only.",
      ].join("\n"),
    },
  ];
}