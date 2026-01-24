import { useRef, useState } from "react";

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function useCopyFeedback(timeoutMs = 1800) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  async function copy(key: string, text: string) {
    const ok = await copyToClipboard(text);
    if (!ok) return false;

    setCopiedKey(key);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopiedKey(null), timeoutMs);
    return true;
  }

  function isCopied(key: string) {
    return copiedKey === key;
  }

  return { copy, isCopied };
}
