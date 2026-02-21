// prompts/translate_to_fa_text.ts

export function buildTranslateToFaTextPrompt(args: {
  texts_en: string[];
  tone?: string;
}) {
  const texts = Array.isArray(args.texts_en) ? args.texts_en : [];

  return [
    {
      role: "system",
      content: [
        "Translate each English line into Persian (Farsi).",
        "Return ONLY valid JSON and nothing else.",
        "",
        "Output schema (MUST follow exactly):",
        '{"translations":[{"text":"..."}]}',
        "",
        "Rules:",
        "- The number of items in translations MUST equal the number of input lines.",
        "- Each translations[i].text must be a SINGLE LINE Persian translation.",
        "- Keep hashtags, mentions, and URLs EXACTLY unchanged.",
        "- No emojis. No explanations.",
        "- If a line is unclear, set that item's text to an empty string.",
        "",
        "Example output:",
        '{"translations":[{"text":"نمونه ترجمه ۱"},{"text":"نمونه ترجمه ۲"}]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({ lines: texts, tone: args.tone ?? "neutral" }, null, 0),
    },
  ];
}