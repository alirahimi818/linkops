import { useEffect, useMemo, useRef, useState } from "react";
import { copyText } from "../../lib/clipboard";
import { IconShare } from "../ui/icons";

function buildShareUrl(params: Record<string, string | undefined>) {
  const url = new URL(window.location.href);
  const sp = new URLSearchParams(url.search);

  for (const [k, v] of Object.entries(params)) {
    if (!v) sp.delete(k);
    else sp.set(k, v);
  }

  url.search = sp.toString();
  return url.toString();
}

function canNativeShare(url: string) {
  const nav: any = navigator;
  if (!nav?.share) return false;
  if (typeof nav.canShare === "function") {
    try {
      return nav.canShare({ url }) !== false;
    } catch {
      return true;
    }
  }
  return true;
}

function openUrl(u: string) {
  window.open(u, "_blank", "noopener,noreferrer");
}

export default function ShareMenu(props: {
  itemId: string;
  title?: string;
  className?: string;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const shareUrl = useMemo(() => {
    return buildShareUrl({
      item: props.itemId,
      tab: "todo",
      cat: undefined,
      catName: undefined,
    });
  }, [props.itemId]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  async function doCopy() {
    await copyText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
    setOpen(false);
  }

  async function doNativeShare() {
    const nav: any = navigator;
    if (!canNativeShare(shareUrl)) {
      await doCopy();
      return;
    }
    try {
      // Important: do NOT pass text if you want the URL to be shared reliably on iOS
      await nav.share({ title: props.title ?? "Share", url: shareUrl });
      setOpen(false);
    } catch {
      // User canceled / failed
    }
  }

  function shareTelegram() {
    const t = props.title ? `${props.title}` : "";
    const u = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(t)}`;
    openUrl(u);
    setOpen(false);
  }

  function shareWhatsApp() {
    const msg = props.title ? `${props.title}\n${shareUrl}` : shareUrl;
    const u = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    openUrl(u);
    setOpen(false);
  }

  function shareX() {
    const t = props.title ? `${props.title}\n${shareUrl}` : shareUrl;
    const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}`;
    openUrl(u);
    setOpen(false);
  }

  function shareEmail() {
    const subject = props.title ?? "Shared item";
    const body = props.title ? `${props.title}\n\n${shareUrl}` : shareUrl;
    const u = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = u;
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={props.className ?? "relative inline-flex"}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100 transition"
        aria-haspopup="menu"
        aria-expanded={open}
        title="اشتراک‌گذاری"
      >
        <IconShare className="h-4 w-4" title="اشتراک‌گذاری" />
        <span>{props.buttonLabel ?? "اشتراک"}</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg"
        >
          <MenuItem onClick={doNativeShare} label="اشتراک‌گذاری سیستم" />
          <MenuItem onClick={doCopy} label={copied ? "کپی شد" : "کپی لینک"} />

          <div className="my-1 h-px bg-zinc-100" />

          <MenuItem onClick={shareTelegram} label="تلگرام" />
          <MenuItem onClick={shareWhatsApp} label="واتساپ" />
          <MenuItem onClick={shareX} label="X (توییتر)" />
          <MenuItem onClick={shareEmail} label="ایمیل" />
        </div>
      ) : null}
    </div>
  );
}

function MenuItem(props: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={props.onClick}
      className="flex w-full items-center justify-between px-4 py-3 text-right text-sm text-zinc-800 hover:bg-zinc-50 transition"
    >
      <span>{props.label}</span>
      <span className="text-zinc-400">›</span>
    </button>
  );
}
