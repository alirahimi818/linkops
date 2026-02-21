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
        "You translate English X/Twitter replies into natural Persian (Farsi).",
        "Return ONLY valid JSON.",
        'Schema: {"translations":[{"text":string}]}',
        "",
        "Requirements:",
        "- translations.length must equal the number of input lines.",
        "- Each translation must be ONE single-line Persian sentence.",
        "- Keep hashtags, mentions, and URLs exactly unchanged.",
        "- Do not add emojis.",
        "- Do not add explanations.",
        "",
        "Write clean, natural Persian suitable for social media.",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          lines: texts,
          tone: args.tone ?? "demanding",
        },
        null,
        0,
      ),
    },
  ];
}