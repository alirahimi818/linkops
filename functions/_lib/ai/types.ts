export type Tone =
  | "angry"        // خشم، اعتراض، فریاد
  | "outraged"     // شوکه، خشم اخلاقی، افشا
  | "demanding"    // مطالبه‌گر، فشار مستقیم
  | "urgent"       // فوری، هشداردهنده
  | "sad"          // سوگ، اندوه، داغ
  | "hopeful"      // امید محتاطانه
  | "defiant"      // سرسخت، نافرمان
  | "sarcastic"    // طعنه‌دار، کنایه
  | "calm_firm"    // آرام ولی محکم
  | "neutral";     // خنثی، بی‌طرف

export type GenerateInput = {
  x_url?: string;
  // Persian inputs
  title_fa: string;
  description_fa: string;
  need_fa: string;
  comment_type_fa: string;

  tone: Tone;

  // Fixed domain/topic, but keep field for logging
  stream: "political";
  topic: "iran_revolution_jan_2026";

  // whitelist hashtags (with or without leading #)
  allowed_hashtags: string[];

  count: number;

  // Examples to steer style
  examples?: Array<{
    text: string; // English sample
  }>;
};

export type DraftComment = {
  text: string; // English, may include #hashtags and @mentions
};

export type DraftOutput = {
  comments: DraftComment[];
};

export type FinalComment = {
  text: string; // English (same as draft)
  translation_text: string; // Persian translation, can be empty string if translation failed after retries
};

export type FinalOutput = {
  comments: Array<{ text: string; translation_text: string }>;

  // Optional autofill fields
  meta?: {
    title?: string;
    description?: string;
    source?: {
      x_url?: string;
      post_text?: string;
      reply_texts?: string[];
    };
  };
};


// Provider chat types
export type AIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIChatRequest = {
  messages: AIChatMessage[];
  temperature?: number;
  max_tokens?: number;
  mode?: "admin" | "public";

  // xAI server-side tools support (ignored by Cloudflare)
  tools?: any[];
  tool_choice?: "none" | "auto" | "required" | { type: "function"; name: string };
  max_turns?: number;
  response_format?: { type: "text" | "json_object" | "json_schema"; json_schema?: any };
};

export type AIChatResponse = {
  content: string; // raw assistant output (should be JSON)
  raw?: unknown;
};

export type AIProviderName = "cloudflare" | "openai" | "xai";

export interface AIProvider {
  name: AIProviderName;
  model?: string;
  chat(req: AIChatRequest): Promise<AIChatResponse>;
}
