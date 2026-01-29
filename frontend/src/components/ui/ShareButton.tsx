import { useMemo, useState } from "react";
import { IconShare } from "./icons";

function buildShareUrl(pathname: string, params: Record<string, string | undefined>) {
  const url = new URL(window.location.href);
  url.pathname = pathname;

  const sp = new URLSearchParams(url.search);

  for (const [k, v] of Object.entries(params)) {
    if (!v) sp.delete(k);
    else sp.set(k, v);
  }

  url.search = sp.toString();
  return url.toString();
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function ShareButton(props: {
  pathname?: string; // default: current pathname
  itemId: string;
  date?: string;
  title?: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    const path = props.pathname ?? window.location.pathname;
    return buildShareUrl(path, {
      item: props.itemId,
      date: props.date,
      tab: "todo",
      cat: undefined,
      catName: undefined,
    });
  }, [props.pathname, props.itemId, props.date]);

  async function onShare() {
    const title = props.title ?? "Share";
    const text = props.title ? `${props.title}` : "";

    const canNativeShare =
      typeof navigator !== "undefined" &&
      typeof (navigator as any).share === "function" &&
      (!("canShare" in navigator) || (navigator as any).canShare?.({ url: shareUrl }) !== false);

    if (canNativeShare) {
      try {
        await (navigator as any).share({
          title,
          text,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share failed; fallback to copy
      }
    }

    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } else {
      // Last resort
      window.prompt("Copy this link:", shareUrl);
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      className={
        props.className ??
        "inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100 transition"
      }
      title="اشتراک‌گذاری"
      aria-label="Share"
    >
      <IconShare className="h-4 w-4" />
      <span>{copied ? "کپی شد" : props.label ?? "اشتراک‌گذاری"}</span>
    </button>
  );
}
