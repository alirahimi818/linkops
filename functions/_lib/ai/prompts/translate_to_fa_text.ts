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
        "You translate English X/Twitter replies into Persian (Farsi).",
        "Return ONLY valid JSON and nothing else.",
        'Schema: {"translations":[{"text":string}]}',
        "",
        "Rules:",
        "- translations.length MUST equal the number of input lines.",
        "- Each translation must be a SINGLE LINE in Persian.",
        "- Keep hashtags (#...) and mentions (@...) EXACTLY unchanged.",
        "- Keep URLs unchanged.",
        "- No emojis.",
        "- If any line is unclear, output an empty string for that item.",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          tone: args.tone ?? "neutral",
          stream: args.stream ?? "",
          topic: args.topic ?? "",
          lines: texts,
        },
        null,
        0,
      ),
    },
  ];
}