import type { AIProvider, AIProviderName } from "./types";
import { CloudflareAIProvider } from "./providers/cloudflare";

function getProviderName(env: Env): AIProviderName {
  return (env.AI_PROVIDER as AIProviderName) || "cloudflare";
}

export function getAIProvider(env: Env): AIProvider {
  const name = getProviderName(env);
  switch (name) {
    case "cloudflare":
      return new CloudflareAIProvider(env);
    default:
      return new CloudflareAIProvider(env);
  }
}
