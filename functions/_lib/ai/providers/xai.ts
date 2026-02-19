import type { AIProvider, AIChatRequest, AIChatResponse } from "../types";

type AIModelMode = "admin" | "public";

function getModel(env: Env, mode: AIModelMode): string {
  const adminModel = (env as any).AI_MODEL_ADMIN;
  const publicModel = (env as any).AI_MODEL_PUBLIC;

  if (mode === "admin" && typeof adminModel === "string" && adminModel.trim()) {
    return adminModel.trim();
  }
  if (mode === "public" && typeof publicModel === "string" && publicModel.trim()) {
    return publicModel.trim();
  }

  const fallback = (env as any).AI_MODEL;
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim();

  // sensible default for your case
  return "grok-4-1-fast-reasoning";
}

function extractOutputText(resp: any): string {
  const out = Array.isArray(resp?.output) ? resp.output : [];
  const parts: string[] = [];

  for (const item of out) {
    if (item?.type === "message" && item?.role === "assistant") {
      const content = Array.isArray(item?.content) ? item.content : [];
      for (const c of content) {
        if (c?.type === "output_text" && typeof c?.text === "string") {
          parts.push(c.text);
        }
      }
    }
  }

  return parts.join("").trim();
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
    if (!apiKey || !String(apiKey).trim()) {
      throw new Error("MISSING_XAI_API_KEY");
    }

    const body: any = {
      model,
      input: req.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: req.temperature,
      max_output_tokens: req.max_tokens,
    };

    // ✅ Tools (Responses API)
    if (req.tools && Array.isArray(req.tools) && req.tools.length > 0) {
      body.tools = req.tools;
      if (req.tool_choice) body.tool_choice = req.tool_choice;
      if (typeof req.parallel_tool_calls === "boolean") {
        body.parallel_tool_calls = req.parallel_tool_calls;
      }
    }

    const res = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      // keep raw text
    }

    if (!res.ok) {
      const msg =
        (data && (data.error?.message || data.message || data.error)) ||
        text ||
        `HTTP_${res.status}`;
      const err: any = new Error(`XAI_HTTP_${res.status}: ${msg}`);
      err.status = res.status;
      err.data = data ?? text;
      throw err;
    }

    const content = extractOutputText(data) || JSON.stringify(data);
    return { content, raw: data };
  }
}