// providers/xai.ts
import type { AIProvider, AIChatRequest, AIChatResponse } from "../types";

function getModel(env: Env, mode: "admin" | "public"): string {
  const adminModel = (env as any).AI_MODEL_ADMIN;
  const publicModel = (env as any).AI_MODEL_PUBLIC;

  if (mode === "admin" && typeof adminModel === "string" && adminModel.trim()) return adminModel.trim();
  if (mode === "public" && typeof publicModel === "string" && publicModel.trim()) return publicModel.trim();

  const fallback = (env as any).AI_MODEL;
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim();

  return "grok-4-1-fast-reasoning";
}

function toResponsesInput(messages: Array<{ role: string; content: string }>) {
  return messages.map((m) => ({
    role: m.role,
    content: [{ type: "text", text: String(m.content ?? "") }],
  }));
}

function extractText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;

  const out = Array.isArray(data?.output) ? data.output : [];
  const texts: string[] = [];

  for (const block of out) {
    const content = Array.isArray(block?.content) ? block.content : [];
    for (const c of content) {
      if (typeof c?.text === "string") texts.push(c.text);
    }
  }

  return texts.join("").trim();
}

export class XAIProvider implements AIProvider {
  name: "xai" = "xai";
  model?: string;

  constructor(private env: Env) {}

  async chat(req: AIChatRequest): Promise<AIChatResponse> {
    const mode = req.mode === "admin" ? "admin" : "public";
    const model = getModel(this.env, mode);
    this.model = model;

    const apiKey = (this.env as any).XAI_API_KEY;
    if (!apiKey) throw new Error("MISSING_XAI_API_KEY");

    const body: any = {
      model,
      input: toResponsesInput(req.messages),
      temperature: req.temperature ?? 0.7,
      max_output_tokens: req.max_tokens ?? 1000,
      store: false,
    };

    // Tooling support (x_search)
    if (Array.isArray(req.tools) && req.tools.length) body.tools = req.tools;
    if (req.tool_choice !== undefined) body.tool_choice = req.tool_choice;
    if (req.response_format !== undefined) body.response_format = req.response_format;
    if (typeof req.max_turns === "number") body.max_turns = req.max_turns;

    const res = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        (data && (data.error?.message || data.error || data.message)) ||
        `XAI_HTTP_${res.status}`;
      throw new Error(String(msg));
    }

    return { content: extractText(data), raw: data };
  }
}