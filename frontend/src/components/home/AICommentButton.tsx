import { useState } from "react";
import CommentRowUI from "./CommentRowUI";
import { generatePublicComment } from "../../lib/api";
import { isXUrl, buildXIntentTweetUrl, buildXIntentReplyUrl } from "../../lib/socialIntents";
import { openExternal } from "../../lib/openExternal";
import { IconSparkles } from "../ui/icons";
import Portal from "../ui/Portal";

type Phase = "idle" | "picking" | "loading" | "done" | "rate_limited" | "error";

type GeneratedComment = {
  text: string;
  translation_text: string | null;
};

const TONES: { value: string; label: string }[] = [
  { value: "demanding",  label: "مطالبه‌گر" },
  { value: "urgent",     label: "فوری" },
  { value: "outraged",   label: "معترض" },
  { value: "angry",      label: "خشمگین" },
  { value: "defiant",    label: "سرسخت" },
  { value: "sarcastic",  label: "طنزآمیز" },
  { value: "hopeful",    label: "امیدوار" },
  { value: "sad",        label: "غمگین" },
  { value: "calm_firm",  label: "آرام و محکم" },
];

export default function AICommentButton(props: {
  itemId: string;
  itemUrl: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<GeneratedComment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const xEnabled = isXUrl(props.itemUrl);

  function openTweet(text: string) {
    openExternal(buildXIntentTweetUrl(text));
  }

  function openReply(url: string, text: string) {
    const u = buildXIntentReplyUrl(url, text);
    openExternal(u || buildXIntentTweetUrl(text));
  }

  async function handleToneSelect(tone: string) {
    setPhase("loading");
    try {
      const res = await generatePublicComment(props.itemId, { tone });
      setResult({
        text: res.comment.text,
        translation_text: res.comment.translation_text ?? null,
      });
      setPhase("done");
    } catch (e) {
      const err = e as { status?: number; data?: { code?: string }; message?: string };
      if (err?.status === 429 || err?.data?.code === "RATE_LIMITED") {
        setPhase("rate_limited");
      } else {
        setError(err?.message || "خطایی رخ داد");
        setPhase("error");
      }
    }
  }

  // ── idle: just the button ──────────────────────────────────────────────
  if (phase === "idle" || phase === "error") {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => { setPhase("picking"); setError(null); }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-100 active:bg-violet-200"
        >
          <IconSparkles className="h-3.5 w-3.5" />
          کامنت AI
        </button>
        {phase === "error" && error ? (
          <div className="text-xs text-red-600">{error}</div>
        ) : null}
      </div>
    );
  }

  // ── loading ────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-400">
        <IconSparkles className="h-3.5 w-3.5 animate-pulse" />
        در حال تولید...
      </div>
    );
  }

  // ── rate limited ───────────────────────────────────────────────────────
  if (phase === "rate_limited") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
        ۶۰ ثانیه صبر کنید و دوباره امتحان کنید.
      </div>
    );
  }

  // ── done ───────────────────────────────────────────────────────────────
  if (phase === "done" && result) {
    return (
      <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-violet-700">
          <IconSparkles className="h-3.5 w-3.5" />
          کامنت AI
        </div>
        <CommentRowUI
          text={result.text}
          translation={result.translation_text}
          url={props.itemUrl}
          xEnabled={xEnabled}
          onOpenTweet={openTweet}
          onOpenReply={openReply}
        />
      </div>
    );
  }

  // ── picking (tone modal) ───────────────────────────────────────────────
  return (
    <Portal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={() => setPhase("idle")}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 top-1/2 z-50 w-72 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl"
        dir="rtl"
      >
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
            <IconSparkles className="h-4 w-4 text-violet-500" />
            لحن کامنت رو انتخاب کن
          </div>
          <button
            type="button"
            onClick={() => setPhase("idle")}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            aria-label="بستن"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Tone chips */}
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleToneSelect(t.value)}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 active:bg-violet-100"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </Portal>
  );
}
