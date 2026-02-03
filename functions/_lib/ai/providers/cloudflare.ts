import type { AIProvider, AIChatRequest, AIChatResponse } from "../types";

type AIModelMode = "admin" | "public";

function getModel(env: Env, mode: AIModelMode): string {
  // Prefer mode-specific env vars
  const adminModel = env.AI_MODEL_ADMIN;
  const publicModel = env.AI_MODEL_PUBLIC;

  if (mode === "admin" && typeof adminModel === "string" && adminModel.trim()) {
    return adminModel.trim();
  }

  if (mode === "public" && typeof publicModel === "string" && publicModel.trim()) {
    return publicModel.trim();
  }

  // Backward-compatible fallback if you still have AI_MODEL
  const fallback = (env as any).AI_MODEL;
  if (typeof fallback === "string" && fallback.trim()) {
    return fallback.trim();
  }

  // Hard fallback
  return "@cf/meta/llama-3.1-8b-instruct-fast";
}

export class CloudflareAIProvider implements AIProvider {
  name: "cloudflare" = "cloudflare";

  constructor(private env: Env) {}

  async chat(req: AIChatRequest): Promise<AIChatResponse> {
    // Default mode if caller doesn't pass one
    const mode: AIModelMode = req.mode === "admin" ? "admin" : "public";
    const model = getModel(this.env, mode);

    const res = await this.env.AI.run(model, {
      messages: req.messages,
      temperature: req.temperature,
      max_tokens: req.max_tokens,
    });

    const content =
      res && typeof res === "object" && "response" in res && typeof (res as any).response === "string"
        ? (res as any).response
        : JSON.stringify(res);

    return { content, raw: res };
  }
}