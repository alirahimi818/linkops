// prompts/translate_to_fa_text.ts

export function buildTranslateToFaTextPrompt(args: {
  texts_en: string[];
  tone?: string;
  stream?: string;
  topic?: string;
}) {
  const texts = Array.isArray(args.texts_en) ? args.texts_en : [];

  return [
    {
      role: "system",
      content: [
        "Translate each English X/Twitter reply into Persian (Farsi).",
        "Return ONLY valid JSON and nothing else.",
        "",
        "You MUST follow this exact schema:",
        '{"translations":[{"text":"..."}]}',
        "",
        "Rules:",
        "- translations.length must equal the number of input lines.",
        "- Each translations[i].text must be a SINGLE LINE Persian translation.",
        "- Keep hashtags, mentions, and URLs EXACTLY unchanged.",
        "- No emojis. No explanations.",
        "- If a line is unclear, output an empty string for that item.",
        "",
        "Example:",
        '{"translations":[{"text":"ترجمه ۱"},{"text":"ترجمه ۲"}]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          lines: texts,
          tone: args.tone ?? "demanding",
          stream: args.stream ?? "political",
          topic: args.topic ?? "iran_revolution_jan_2026",
        },
        null,
        0,
      ),
    },
  ];
}