// providers/xai.ts
import type { AIProvider, AIChatRequest, AIChatResponse } from "../types";

type AIModelMode = "admin" | "public";

function getModel(env: Env, mode: AIModelMode): string {
  const adminModel = (env as any).AI_MODEL_ADMIN;
  const publicModel = (env as any).AI_MODEL_PUBLIC;

  if (mode === "admin" && typeof adminModel === "string" && adminModel.trim()) return adminModel.trim();
  if (mode === "public" && typeof publicModel === "string" && publicModel.trim()) return publicModel.trim();

  return "grok-2-latest";
}

async function fetchJson(url: string, init: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  const txt = await res.text();

  if (!res.ok) {
    throw new Error(`XAI_HTTP_${res.status}: ${txt.slice(0, 500)}`);
  }

  try {
    return JSON.parse(txt);
  } catch {
    throw new Error(`XAI_INVALID_JSON: ${txt.slice(0, 500)}`);
  }
}

export class XAIProvider implements AIProvider {
  name: "xai" = "xai";
  model?: string;

  constructor(private env: Env) {}

  async chat(req: AIChatRequest): Promise<AIChatResponse> {
    const mode: AIModelMode = req.mode === "admin" ? "admin" : "public";
    const model = getModel(this.env, mode);
    this.model = model;

    const apiKey = (this.env as any).XAI_API_KEY;
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      throw new Error("MISSING_XAI_API_KEY");
    }

    const baseUrl = String((this.env as any).XAI_BASE_URL || "https://api.x.ai").trim();
    const url = `${baseUrl.replace(/\/+$/, "")}/v1/chat/completions`;

    const payload: any = {
      model,
      messages: req.messages,
    };

    if (typeof req.temperature === "number") payload.temperature = req.temperature;
    if (typeof req.max_tokens === "number") payload.max_tokens = req.max_tokens;

    // Server-side tools (x_search/web_search/etc.)
    if (Array.isArray(req.tools) && req.tools.length > 0) payload.tools = req.tools;
    if (req.tool_choice) payload.tool_choice = req.tool_choice;
    if (typeof req.max_turns === "number") payload.max_turns = req.max_turns;

    // JSON output mode (optional)
    if (req.response_format) payload.response_format = req.response_format;

    const raw = await fetchJson(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify(payload),
    });

    const content =
      raw &&
      typeof raw === "object" &&
      Array.isArray((raw as any).choices) &&
      (raw as any).choices[0]?.message?.content
        ? String((raw as any).choices[0].message.content)
        : JSON.stringify(raw);

    return { content, raw };
  }
}
