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
  // Optional X URL input
  x_url?: string;

  title_fa: string;
  description_fa: string;
  need_fa: string;
  comment_type_fa: string;

  tone: Tone;
  stream: "political";
  topic: "iran_revolution_jan_2026";
  allowed_hashtags: string[];
  count: number;
  examples?: Array<{ text: string }>;
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
  comments: FinalComment[];
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

  // optional tool support (xAI)
  tools?: any[];
  tool_choice?: any;
  parallel_tool_calls?: boolean;
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
