export type Tone = "friendly" | "formal" | "neutral" | "witty" | "professional";

export type GenerateInput = {
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
  comments: FinalComment[];
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
};

export type AIChatResponse = {
  content: string; // raw assistant output (should be JSON)
  raw?: unknown;
};

export type AIProviderName = "cloudflare" | "openai";

export interface AIProvider {
  name: AIProviderName;
  model?: string;
  chat(req: AIChatRequest): Promise<AIChatResponse>;
}
