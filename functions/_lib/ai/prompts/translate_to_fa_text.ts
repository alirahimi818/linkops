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
        "You are a strict, high-quality Persian translator specialized in political X/Twitter content.",
        "Translate each English line into natural, fluent Persian that sounds like it was written by a native Iranian opposition activist on X.",
        "",
        "Return ONLY valid JSON — nothing else before or after.",
        "Schema (exact):",
        '{"translations":[{"text":"..."},{"text":"..."},...]}',
        "",
        "Strict rules:",
        "- Number of items in translations MUST equal number of input lines.",
        "- Each item: object with exactly one key: 'text' → value is SINGLE-LINE Persian string.",
        "- Translate faithfully but make it natural & idiomatic Persian (avoid word-by-word stiffness).",
        "- Keep ALL hashtags, @mentions, URLs 100% unchanged — position and spelling exact.",
        "- Do NOT add, remove or change any hashtag/mention/URL.",
        "- Preserve demanding, passionate, revolutionary tone — use common opposition phrasing where it fits naturally.",
        "- Use رایج‌ترین واژگان اپوزیسیون فارسی‌زبان در X (مثلاً: مرگ بر دیکتاتور، جاوید شاه، ملاها، رژیم child-killer و غیره اگر در متن اصلی معادل دارد).",
        "- If source mentions specific year/event (1979, 2026 etc), keep it accurate.",
        "- No extra commentary, no length note, no emojis, no explanations.",
        "- If a line cannot be translated faithfully (very unclear), output empty string ''.",
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