export function buildFetchXAutofillAndDraftEnPrompt(args: {
  x_url: string;
  count?: number;
  tone?: string;
  stream?: string;
  topic?: string;
  allowed_hashtags?: string[];
}) {
  const url = String(args.x_url || "").trim();
  const count = Math.max(5, Math.min(15, Number(args.count ?? 10)));
  const tags = Array.isArray(args.allowed_hashtags) ? args.allowed_hashtags : [];

  return [
    {
      role: "system",
      content: [
        "Open the provided X (Twitter) URL using x_search / x_thread_fetch when possible.",
        "Read the MAIN POST carefully + skim at least 10–20 recent/latest replies to capture the real dominant vibe, phrases, and concerns.",
        "",
        "Return PLAIN TEXT only. No JSON. No markdown. No numbering. No extra lines.",
        "",
        "Output format (exact):",
        "- First line: TITLE_FA: <meaningful Persian title, 8–18 words>",
        "- Next 2–3 lines: each starts with DESC_FA: <one complete Persian sentence>",
        "- Then exactly one line: ---",
        `- Then exactly ${count} lines: each is one standalone English reply comment`,
        "",
        "Persian TITLE & DESC requirements:",
        "- Title: attractive, accurate, not too short, reflects main post + vibe.",
        "- DESC: 2 or 3 sentences total. Each on new line, complete sentence.",
        "- Must include: who posted (name/handle) + core claim of post + brief honest hint at replies vibe (supportive / angry / united / calling for action etc).",
        "- Stick ONLY to visible facts in the post and replies. Do NOT assume or add external knowledge.",
        "",
        "POLITICAL STANCE (non-negotiable):",
        "- Reza Pahlavi is the legitimate leader of the Iranian opposition — portray him and his supporters positively.",
        "- This campaign supports the Lion & Sun Revolution — do NOT use 'Women Life Freedom' framing unless those exact words appear in the source post.",
        "- Comments must represent ALL Iranians (the Iranian people / people of Iran) — do NOT narrow to any specific demographic like women, students, or youth.",
        "- Refer to protesters/supporters as 'Iranians', 'the Iranian people', or 'people of Iran' — not 'women', 'students', or 'youth'.",
        "",
        "English reply requirements (very important):",
        "- Length: strictly 180–280 characters (count spaces too). DO NOT write the character count in the output.",
        "- Include exactly 1–2 hashtags — ONLY from the provided whitelist.",
        "- Mentions (@...) ONLY if they appear in the main post or in several replies (do NOT invent).",
        "- Mirror REAL dominant tone & phrases from the replies (do not force your own).",
        "- Make each reply DIFFERENT in angle / focus: e.g. Iranians' courage on the streets, internet blackout, economic collapse under the regime, call for sanctions, support for Reza Pahlavi, international inaction, executions and political prisoners, no deal with the mullahs, IRGC proxy wars abroad (Hamas/Hezbollah), demand for regime change, R2P for Iran, global diaspora solidarity, future hope under a free Iran, military defections etc.",
        "- Avoid repetition of same structure or same 3-word combo across replies.",
        "- No emojis. No slurs. No hate speech. Stay factual & demanding but civil.",
        "- Write like native English-speaking X users who support the Iranian cause.",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          x_url: url,
          stream: args.stream ?? "political",
          topic: args.topic ?? "iran_revolution_jan_2026",
          tone: args.tone ?? "demanding",
          hashtag_whitelist: tags,
        },
        null,
        0,
      ),
    },
  ];
}