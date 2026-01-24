function extractXStatusId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();

    if (!host.includes("x.com") && !host.includes("twitter.com")) return null;

    // /{user}/status/{id} or /i/web/status/{id}
    const m = u.pathname.match(/\/status\/(\d+)/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

export function buildXIntentTweetUrl(text: string) {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

export function buildXIntentReplyUrl(itemUrl: string, text: string): string | null {
  const statusId = extractXStatusId(itemUrl);
  if (!statusId) return null;
  return `https://x.com/intent/tweet?in_reply_to=${encodeURIComponent(statusId)}&text=${encodeURIComponent(text)}`;
}

export function isXUrl(itemUrl: string): boolean {
  return extractXStatusId(itemUrl) !== null;
}
