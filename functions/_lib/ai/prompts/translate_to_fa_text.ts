import type { AIChatMessage, Tone } from "../types";

export function buildTranslateToFaTextPrompt(args: {
  text_en: string;
  tone: Tone;
  stream: "political";
  topic: "iran_revolution_jan_2026";
}): AIChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You translate English social media reply comments into Persian (fa).",
        "Return ONLY the Persian translation text. No JSON. No markdown. No quotes. No extra text.",
        "",
        "Rules:",
        "- Keep hashtags (#...) and mentions (@...) EXACTLY unchanged (do not translate them).",
        "- Output MUST be a single line (no line breaks).",
        "- Keep meaning and tone natural in Persian.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Tone: ${args.tone}`,
        `Stream: ${args.stream}`,
        `Topic: ${args.topic}`,
        "",
        "Translate this text to Persian. Return ONLY the translation:",
        args.text_en,
      ].join("\n"),
    },
  ];
}
