import { useEffect, useMemo, useRef, useState } from "react";
import { copyText } from "../../lib/clipboard";
import {
  IconLink,
  IconMail,
  IconShare,
  IconTelegram,
  IconWhatsApp,
  IconX,
} from "./icons";

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

export default function ShareSheet(props: {
  itemId: string;
  title?: string;
  className?: string;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Separate state for animation (mount -> animate in, animate out -> unmount)
  const [mounted, setMounted] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);

  const shareUrl = useMemo(() => {
    return buildShareUrl({
      item: props.itemId,
      tab: "todo",
      cat: undefined,
      catName: undefined,
    });
  }, [props.itemId]);

  // Mount/unmount with exit animation
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;

    const t = window.setTimeout(() => setMounted(false), 220);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  // ESC close
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open]);

  // Focus & scroll lock
  useEffect(() => {
    if (!open) return;

    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    window.setTimeout(() => panelRef.current?.focus(), 0);

    return () => {
      body.style.overflow = prevOverflow;
    };
  }, [open]);

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
      // iOS: omit text so URL sharing is reliable
      await nav.share({ title: props.title ?? "Share", url: shareUrl });
      setOpen(false);
    } catch {
      // user canceled / failed
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          props.className ??
          "inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100 transition"
        }
        title="اشتراک‌گذاری"
      >
        <IconShare className="h-4 w-4" title="اشتراک‌گذاری" />
        <span>{props.buttonLabel ?? "اشتراک"}</span>
      </button>

      {mounted ? (
        <div className="fixed inset-0 z-[999]">
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${
              open ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Sheet */}
          <div className="absolute inset-x-0 bottom-0">
            <div
              ref={panelRef}
              tabIndex={-1}
              dir="rtl"
              className={[
                "mx-auto w-full max-w-md rounded-t-3xl border border-zinc-200 bg-white p-4 shadow-2xl outline-none",
                "transition-transform duration-200 ease-out",
                open ? "translate-y-0" : "translate-y-6",
              ].join(" ")}
            >
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-200" />

              <div className="mb-2 text-right">
                <div className="text-sm font-semibold text-zinc-900">
                  اشتراک‌گذاری
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  لینک این آیتم را از طریق روش‌های زیر به اشتراک بگذارید
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <ActionTile
                  icon={<IconLink className="h-6 w-6" title="کپی لینک" />}
                  label={copied ? "کپی شد" : "کپی لینک"}
                  onClick={doCopy}
                />
                <ActionTile
                  icon={<IconTelegram className="h-6 w-6" title="تلگرام" />}
                  label="تلگرام"
                  onClick={shareTelegram}
                />
                <ActionTile
                  icon={<IconWhatsApp className="h-6 w-6" title="واتساپ" />}
                  label="واتساپ"
                  onClick={shareWhatsApp}
                />
                <ActionTile
                  icon={<IconX className="h-6 w-6" title="X" />}
                  label="X"
                  onClick={shareX}
                />
                <ActionTile
                  icon={<IconMail className="h-6 w-6" title="ایمیل" />}
                  label="ایمیل"
                  onClick={shareEmail}
                />
                <ActionTile
                  icon={
                    <IconShare className="h-6 w-6" title="اشتراک‌گذاری سیستم" />
                  }
                  label="سیستم"
                  onClick={doNativeShare}
                />
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-4 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 hover:bg-zinc-50 transition"
              >
                بستن
              </button>

              <div
                className="mt-3 text-center text-[11px] text-zinc-400"
                dir="ltr"
              >
                {shareUrl}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ActionTile(props: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white p-3 text-center hover:bg-zinc-50 transition active:scale-[0.98]"
    >
      <div className="text-zinc-800">{props.icon}</div>
      <div className="text-xs text-zinc-700">{props.label}</div>
    </button>
  );
}
