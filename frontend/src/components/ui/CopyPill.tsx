import React, { useEffect, useId, useState } from "react";
import { copyText } from "../../lib/clipboard";
import { IconCheck, IconCopy } from "./icons";

type Props = {
  value: string;
  label: string;            // what user sees
  title?: string;           // tooltip
  className?: string;

  copiedMs?: number;        // default 1600
  dir?: "rtl" | "ltr" | "auto";
  icon?: "copy";            // future-proof (later you can add more)
  compact?: boolean;        // small pill
};

export default function CopyPill({
  value,
  label,
  title,
  className,
  copiedMs = 1600,
  dir = "auto",
  compact = false,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [live, setLive] = useState("");
  const liveId = useId();

  useEffect(() => {
    if (!copied) return;
    setLive("کپی شد");
    const t = window.setTimeout(() => setLive(""), copiedMs);
    return () => window.clearTimeout(t);
  }, [copied, copiedMs]);

  async function act() {
    if (!value) return;
    const ok = await copyText(value);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), copiedMs);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      act();
    }
  }

  return (
    <span className={className ?? ""} dir={dir}>
      <span
        role="button"
        tabIndex={0}
        onClick={act}
        onKeyDown={onKeyDown}
        aria-describedby={live ? liveId : undefined}
        title={title ?? "کلیک کنید تا کپی شود"}
        className={[
          "inline-flex select-none items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-300",
          compact ? "px-2 py-1" : "",
          copied
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50",
        ].join(" ")}
      >
        {copied ? <IconCheck className="h-4 w-4" /> : <IconCopy className="h-4 w-4" />}
        <span className="whitespace-nowrap">{label}</span>
      </span>

      {/* SR-only feedback */}
      <span id={liveId} className="sr-only" aria-live="polite">
        {live}
      </span>
    </span>
  );
}
