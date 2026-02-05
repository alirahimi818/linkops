import type { AIChatMessage, Tone } from "../types";

export function buildTranslateToFaTextPrompt(args: {
  texts_en: string[];
  tone: Tone;
  stream: "political";
  topic: "iran_revolution_jan_2026";
}): AIChatMessage[] {
  const count = args.texts_en.length;

  return [
    {
      role: "system",
      content: [
        "You translate English social media reply comments into Persian (fa).",
        "Return ONLY valid JSON. No markdown. No extra text.",
        "",
        "Output schema (strict):",
        `- Return exactly: {"translations":[{"text":string}]}`,
        `- translations.length MUST equal ${count}`,
        '- Top-level JSON must contain ONLY the key "translations".',
        "",
        "Rules per item:",
        "- Output text MUST be a single line (no line breaks).",
        "- Keep hashtags (#...) and mentions (@...) EXACTLY unchanged (do not translate or edit them).",
        "- Do NOT output any Chinese/Japanese/Korean characters.",
        "- Translation does not need to be perfect; just natural Persian.",
        "- If you are unsure, output an empty string for that item.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Tone: ${args.tone}`,
        `Stream: ${args.stream}`,
        `Topic: ${args.topic}`,
        "",
        `Translate these ${count} texts into Persian. Return JSON only:`,
        JSON.stringify({ texts: args.texts_en }, null, 0),
      ].join("\n"),
    },
  ];
}
