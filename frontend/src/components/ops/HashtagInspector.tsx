import { useMemo, useState } from "react";
import Input from "../ui/Input";
import { validateHashtags, type HashtagIssue } from "../../lib/hashtags";
import { copyText } from "../../lib/clipboard";
import ActionPill from "../ui/ActionPill";

type Props = {
  title?: string;
  text: string;
  whitelist: Set<string>;
  onReplaceText?: (next: string) => void; // optional: enable auto-fix
  applySuggestedReplacements?: (text: string, issues: HashtagIssue[]) => string; // inject to avoid circular imports
};

export default function HashtagInspector(props: Props) {
  const [showWhitelist, setShowWhitelist] = useState(false);
  const [q, setQ] = useState("");
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  const issues = useMemo(() => {
    if (!props.text.trim() || props.whitelist.size === 0) return [];
    return validateHashtags(props.text, props.whitelist);
  }, [props.text, props.whitelist]);

  const hasSuggestion = useMemo(() => issues.some((i) => !!i.suggestion), [issues]);

  const whitelistList = useMemo(() => {
    const all = Array.from(props.whitelist).sort((a, b) => a.localeCompare(b));
    const qq = q.trim().toLowerCase();
    if (!qq) return all;
    return all.filter((t) => t.includes(qq));
  }, [props.whitelist, q]);

  async function onCopyTag(tag: string) {
    const ok = await copyText(`#${tag}`);
    if (!ok) return;
    setCopiedTag(tag);
    window.setTimeout(() => setCopiedTag(null), 900);
  }

  function onReplace() {
    if (!props.onReplaceText || !props.applySuggestedReplacements) return;
    const next = props.applySuggestedReplacements(props.text, issues);
    props.onReplaceText(next);
  }

  if (issues.length === 0) return null;

  return (
    <div dir="rtl" className="rounded-xl border border-red-200 bg-red-50 p-3 text-right">
      <div className="mb-2 text-sm font-medium text-red-800">
        {props.title ?? "مشکلات هشتگ"}
      </div>

      <ul className="list-disc ps-5 text-sm text-red-700">
        {issues.map((i, idx) => (
          <li key={idx}>
            <span className="font-mono" dir="ltr">
              {i.raw}
            </span>{" "}
            {i.reason}
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {hasSuggestion && props.onReplaceText && props.applySuggestedReplacements ? (
          <ActionPill title="جایگزینی پیشنهادها" onClick={onReplace}>
            جایگزینی
          </ActionPill>
        ) : null}

        {props.whitelist.size > 0 ? (
          <ActionPill
            title={showWhitelist ? "بستن هشتگ‌های مجاز" : "نمایش هشتگ‌های مجاز"}
            onClick={() => setShowWhitelist((s) => !s)}
          >
            {showWhitelist ? "بستن هشتگ‌های مجاز" : "نمایش هشتگ‌های مجاز"}
          </ActionPill>
        ) : null}
      </div>

      {showWhitelist ? (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3">
          <div className="mb-2 text-sm font-medium text-zinc-800">
            هشتگ‌های مجاز (برای کپی کلیک کنید)
          </div>

          <Input value={q} onChange={setQ} placeholder="جستجو در هشتگ‌ها…" />

          <div className="mt-2 flex flex-wrap gap-2">
            {whitelistList.slice(0, 200).map((t) => (
              <span
                key={t}
                role="button"
                tabIndex={0}
                onClick={() => onCopyTag(t)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onCopyTag(t);
                  }
                }}
                className={[
                  "inline-flex cursor-pointer select-none items-center rounded-full border px-3 py-1 text-xs font-mono transition",
                  copiedTag === t
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50",
                ].join(" ")}
                dir="ltr"
                title="کلیک کنید تا کپی شود"
              >
                #{t} {copiedTag === t ? "✓" : ""}
              </span>
            ))}
          </div>

          {whitelistList.length > 200 ? (
            <div className="mt-2 text-xs text-zinc-500">برای نمایش کمتر، جستجو کنید.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
