import { useMemo, useState } from "react";
import Input from "../ui/Input";
import ActionPill from "../ui/ActionPill";
import { IconCopy } from "../ui/icons";
import { copyText } from "../../lib/clipboard";
import { validateHashtags, type HashtagIssue } from "../../lib/hashtags";

type Props = {
  title?: string;
  text: string;
  whitelist: Set<string>;
  onReplaceText: (next: string) => void;
};

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace ONLY hashtag tokens and avoid partial matches.
 * Example: replace "#IranMassacre" but not "#IranMassacre123"
 */
function applySuggestedReplacementsSafe(text: string, issues: HashtagIssue[]) {
  let out = text;

  const fixable = issues.filter((i) => typeof i.suggestion === "string" && i.suggestion.trim().length > 0);

  for (const i of fixable) {
    const raw = String(i.raw ?? "").trim();
    const sugg = String(i.suggestion ?? "").trim();
    if (!raw || !sugg) continue;

    const from = raw.startsWith("#") ? raw : `#${raw}`;
    const to = `#${sugg}`;

    // boundary: not followed by [A-Za-z0-9_] (unicode aware)
    const re = new RegExp(`${escapeRegExp(from)}(?![\\p{L}\\p{N}_])`, "gu");
    out = out.replace(re, to);
  }

  return out;
}

export default function HashtagInspector({ title, text, whitelist, onReplaceText }: Props) {
  const [showWhitelist, setShowWhitelist] = useState(false);
  const [whitelistQuery, setWhitelistQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const issues = useMemo(() => {
    if (!text.trim() || whitelist.size === 0) return [];
    return validateHashtags(text, whitelist);
  }, [text, whitelist]);

  const fixableCount = useMemo(() => issues.filter((i) => !!i.suggestion).length, [issues]);

  const whitelistList = useMemo(() => {
    const all = Array.from(whitelist).sort((a, b) => a.localeCompare(b));
    const q = whitelistQuery.trim().toLowerCase();
    if (!q) return all;
    return all.filter((t) => t.includes(q));
  }, [whitelist, whitelistQuery]);

  async function copyWithFlash(key: string, value: string) {
    await copyText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 900);
  }

  function doReplace() {
    if (!text.trim() || whitelist.size === 0) return;
    if (issues.length === 0) return;

    const next = applySuggestedReplacementsSafe(text, issues);
    // Even if nothing changes, calling onReplaceText is harmless but we can avoid no-op
    if (next !== text) onReplaceText(next);
  }

  const hasIssues = issues.length > 0;

  return (
    <div dir="rtl" className="rounded-2xl border border-zinc-200 bg-white p-4 text-right">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-zinc-900">{title ?? "نتیجه بررسی"}</div>

        <div className="flex flex-wrap items-center gap-2">
          <ActionPill
            title="جایگزینی پیشنهادها"
            onClick={doReplace}
            successKey="replace"
            className={fixableCount === 0 ? "opacity-50 pointer-events-none" : ""}
          >
            جایگزینی
          </ActionPill>

          <ActionPill
            title="نمایش هشتگ‌های مجاز"
            onClick={() => setShowWhitelist((s) => !s)}
          >
            {showWhitelist ? "بستن هشتگ‌های مجاز" : "نمایش هشتگ‌های مجاز"}
          </ActionPill>
        </div>
      </div>

      <div className="mt-3">
        {!text.trim() ? (
          <div className="text-sm text-zinc-500">برای بررسی، ابتدا متن وارد کنید.</div>
        ) : whitelist.size === 0 ? (
          <div className="text-sm text-zinc-500">وایت‌لیست خالی است.</div>
        ) : !hasIssues ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            هشتگ نامعتبر یا ناشناخته‌ای پیدا نشد ✅
          </div>
        ) : (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <div className="mb-2 text-sm font-medium text-red-800">
              مشکلات هشتگ ({issues.length})
            </div>

            <ul className="list-disc ps-5 text-sm text-red-700 space-y-1">
              {issues.map((i, idx) => (
                <li key={idx}>
                  <span className="font-mono" dir="ltr">{i.raw}</span> {i.reason}
                  {i.suggestion ? (
                    <span className="ms-2">
                      ←{" "}
                      <span className="font-mono text-red-900" dir="ltr">
                        #{i.suggestion}
                      </span>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {showWhitelist ? (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="mb-2 text-sm font-medium text-zinc-800">هشتگ‌های مجاز (برای کپی کلیک کنید)</div>

          <Input value={whitelistQuery} onChange={setWhitelistQuery} placeholder="جستجو در هشتگ‌ها…" />

          <div className="mt-2 flex flex-wrap gap-2">
            {whitelistList.slice(0, 200).map((t) => {
              const key = `tag:${t}`;
              const active = copiedKey === key;

              return (
                <span
                  key={t}
                  dir="ltr"
                  onClick={() => copyWithFlash(key, `#${t}`)}
                  className={[
                    "inline-flex cursor-pointer select-none items-center gap-1 rounded-full border px-3 py-1 text-xs font-mono transition",
                    active
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50",
                  ].join(" ")}
                  title="کلیک کنید تا کپی شود"
                >
                  <IconCopy className="h-3.5 w-3.5 opacity-70" />
                  #{t} {active ? "✓" : ""}
                </span>
              );
            })}
          </div>

          {whitelistList.length > 200 ? (
            <div className="mt-2 text-xs text-zinc-500">برای نمایش کمتر، جستجو کنید.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
