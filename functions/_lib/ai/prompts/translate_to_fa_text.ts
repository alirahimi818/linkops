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
        "You are a strict translator.",
        "Translate each English X/Twitter reply into Persian (Farsi) with high fidelity.",
        "",
        "Return ONLY valid JSON and nothing else.",
        "Schema (MUST match exactly):",
        '{"translations":[{"text":"..."},{"text":"..."},...]}',
        "",
        "Hard rules:",
        "- translations.length MUST equal the number of input lines.",
        '- Each item MUST be an object with exactly one key: "text".',
        "- Each translations[i].text MUST be a SINGLE LINE Persian translation.",
        "- DO NOT add any extra words, commentary, or metadata (e.g. do NOT add '(214 chars)' or similar).",
        "- DO NOT rewrite or expand. Translate only what is in the source line.",
        "- Keep hashtags (#...), mentions (@...), and URLs EXACTLY unchanged.",
        "- Do NOT remove any hashtag/mention/URL that exists in the source.",
        "- Do NOT add new hashtags/mentions/URLs that are not in the source.",
        "- Keep numbers unchanged.",
        "- No emojis.",
        "- If a line is unclear, output an empty string for that item.",
        "",
        "Example output:",
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