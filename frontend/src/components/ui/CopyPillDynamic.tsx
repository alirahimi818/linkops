import React, { useId, useState } from "react";
import { copyText } from "../../lib/clipboard";
import { IconCheck, IconCopy } from "./icons";

export default function CopyPillDynamic(props: {
  getValue: () => string | null;
  label: string;
  title?: string;
  className?: string;
  copiedMs?: number;
  dir?: "rtl" | "ltr" | "auto";
}) {
  const [copied, setCopied] = useState(false);
  const liveId = useId();

  async function act() {
    const v = props.getValue();
    if (!v) return;
    const ok = await copyText(v);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), props.copiedMs ?? 1600);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      act();
    }
  }

  return (
    <span>
      <span
        dir={props.dir ?? "auto"}
        role="button"
        tabIndex={0}
        onClick={act}
        onKeyDown={onKeyDown}
        title={props.title ?? "کلیک کنید تا کپی شود"}
        aria-describedby={liveId}
        className={[
          "inline-flex select-none items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition",
          props.className ?? "",
          copied
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50",
        ].join(" ")}
      >
        {copied ? <IconCheck className="h-4 w-4" /> : <IconCopy className="h-4 w-4" />}
        <span className="whitespace-nowrap">{props.label}</span>
      </span>

      <span id={liveId} className="sr-only" aria-live="polite">
        {copied ? "کپی شد" : ""}
      </span>
    </span>
  );
}
