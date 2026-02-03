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

  allowed_hashtags: string[];
  count: number;

  // Examples to steer style
  examples?: Array<{
    text: string; // English sample
    translation_text?: string;
  }>;
};

export type GeneratedComment = {
  text: string; // English
  translation_text: string; // Persian
  hashtags_used: string[];
};

export type GenerateOutput = {
  comments: GeneratedComment[];
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
  chat(req: AIChatRequest): Promise<AIChatResponse>;
}
