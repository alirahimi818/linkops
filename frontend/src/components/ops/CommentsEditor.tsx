import { useMemo, useState } from "react";
import Textarea from "../ui/Textarea";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { applySuggestedReplacements, type HashtagIssue, validateHashtags } from "../../lib/hashtags";
import HashtagInspector from "../ops/HashtagInspector";

type Props = {
  label?: string;
  value: string[];
  onChange: (next: string[]) => void;
  whitelist: Set<string>; // normalized tags without '#'
  maxItems?: number;
  maxLen?: number;
};

function normalizeComment(s: string, maxLen: number) {
  return s.trim().slice(0, maxLen);
}

function collectIssuesForComments(comments: string[], whitelist: Set<string>): HashtagIssue[] {
  if (comments.length === 0 || whitelist.size === 0) return [];
  const out: HashtagIssue[] = [];
  for (const c of comments) out.push(...validateHashtags(c, whitelist));
  return out;
}

function autoFixComment(comment: string, whitelist: Set<string>): string {
  if (whitelist.size === 0) return comment;
  const issues = validateHashtags(comment, whitelist);
  return applySuggestedReplacements(comment, issues);
}

/**
 * Remove unknown hashtags after replacements.
 * Keeps whitespace and normal text, removes tokens like "#UnknownTag".
 */
function pruneUnknownHashtags(text: string, whitelist: Set<string>) {
  if (whitelist.size === 0) return text;

  const out = text.replace(/(^|\s)#([\p{L}\p{N}_]+)/gu, (_full, lead, tag) => {
    const t = String(tag ?? "").trim();
    if (!t) return lead;
    if (whitelist.has(t)) return `${lead}#${t}`;
    return lead;
  });

  return out.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Detect last hashtag fragment at the end of the textarea (active typing token).
 * Example: "hello #Ir" => fragment "Ir"
 */
function getActiveHashtagFragment(text: string) {
  const m = text.match(/(^|\s)#([^\s#]{1,80})$/u);
  if (!m) return null;
  return { fragment: (m[2] ?? "").trim() };
}

/**
 * Damerau-Levenshtein distance with early exit (small threshold).
 * Useful for "one typo" suggestions.
 */
function damerauLevenshteinWithin(a: string, b: string, maxDist: number) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;

  const al = a.length;
  const bl = b.length;

  // Small strings -> cheap DP with early exit
  const dp: number[][] = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) dp[i][0] = i;
  for (let j = 0; j <= bl; j++) dp[0][j] = j;

  for (let i = 1; i <= al; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      let val = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );

      // transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, dp[i - 2][j - 2] + cost);
      }

      dp[i][j] = val;
      if (val < rowMin) rowMin = val;
    }

    if (rowMin > maxDist) return maxDist + 1;
  }

  return dp[al][bl];
}

function scoreCandidate(query: string, candidate: string) {
  const q = query.toLocaleLowerCase();
  const c = candidate.toLocaleLowerCase();

  if (c === q) return 1000;
  if (c.startsWith(q)) return 900 - Math.min(200, c.length);
  if (c.includes(q)) return 700 - Math.min(200, c.length);

  // typo tolerance:
  // for short queries (2-4), allow distance <= 1
  // for longer (>=5), allow distance <= 2
  const maxDist = q.length <= 4 ? 1 : 2;
  const dist = damerauLevenshteinWithin(q, c.slice(0, Math.max(q.length, Math.min(c.length, q.length + 2))), maxDist);
  if (dist <= maxDist) return 500 - dist * 50 - Math.min(200, c.length);

  return -Infinity;
}

function buildHashtagSuggestions(fragment: string, whitelist: Set<string>, limit = 12) {
  const q = fragment.trim();
  if (q.length < 2) return [];

  const all = Array.from(whitelist);

  const scored = all
    .map((t) => ({ t, score: scoreCandidate(q, t) }))
    .filter((x) => Number.isFinite(x.score) && x.score > -Infinity)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.t);

  return scored;
}

function replaceActiveHashtag(text: string, nextTag: string) {
  return text.replace(/(^|\s)#([^\s#]{1,80})$/u, `$1#${nextTag}`);
}

export default function CommentsEditor({
  label,
  value,
  onChange,
  whitelist,
  maxItems = 50,
  maxLen = 400,
}: Props) {
  const [draft, setDraft] = useState("");

  const activeFrag = useMemo(() => getActiveHashtagFragment(draft), [draft]);

  const suggestions = useMemo(() => {
    if (!activeFrag) return [];
    return buildHashtagSuggestions(activeFrag.fragment, whitelist, 12);
  }, [activeFrag, whitelist]);

  const draftIssues = useMemo(() => {
    if (!draft.trim() || whitelist.size === 0) return [];
    return validateHashtags(draft, whitelist);
  }, [draft, whitelist]);

  const allIssues = useMemo(() => {
    return collectIssuesForComments(value, whitelist);
  }, [value, whitelist]);

  const canAdd = draft.trim().length > 0 && value.length < maxItems;

  function addDraft() {
    if (!canAdd) return;
    const t = normalizeComment(draft, maxLen);
    if (!t) return;

    onChange([...value, t]);
    setDraft("");
  }

  function removeAt(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function replaceAll() {
    if (whitelist.size === 0 || value.length === 0) return;

    const next = value
      .slice(0, maxItems)
      .map((c) => autoFixComment(c, whitelist))
      .map((c) => pruneUnknownHashtags(c, whitelist))
      .map((s) => s.trim())
      .filter(Boolean);

    onChange(next);
  }

  return (
    <div dir="rtl" className="grid gap-2 text-right">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-zinc-800">{label ?? "کامنت‌های پیشنهادی"}</div>
        <div className="text-xs text-zinc-500">
          {value.length} / {maxItems}
        </div>
      </div>

      <Textarea
        dir="auto"
        value={draft}
        onChange={setDraft}
        placeholder="کامنت را بنویسید (Enter برای افزودن، Shift+Enter برای خط جدید). هشتگ‌ها بررسی می‌شوند."
        onKeyDown={(e: any) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            addDraft();
          }
        }}
      />

      {suggestions.length > 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="mb-2 text-xs text-zinc-600">
            پیشنهاد هشتگ‌ها (با کلیک جایگزین می‌شود)
          </div>

          <div className="flex flex-wrap gap-2">
            {suggestions.map((t) => (
              <button
                key={t}
                type="button"
                dir="ltr"
                onClick={() => setDraft((prev) => replaceActiveHashtag(prev, t))}
                className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-mono text-zinc-800 hover:bg-zinc-100 transition"
                title="Insert hashtag"
              >
                #{t}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {draftIssues.length > 0 ? (
        <HashtagInspector
          title="مشکلات هشتگ در متن پیش‌نویس"
          text={draft}
          whitelist={whitelist}
          onReplaceText={setDraft}
          pruneUnknownOnReplace
        />
      ) : null}

      <div className="flex items-center gap-2">
        <Button variant="info" onClick={addDraft} disabled={!canAdd}>
          افزودن کامنت
        </Button>

        <Button
          variant="warning"
          onClick={replaceAll}
          disabled={value.length === 0 || whitelist.size === 0}
          title="اصلاح خودکار غلط‌های قابل‌تبدیل + حذف هشتگ‌های ناشناخته در همه کامنت‌ها"
        >
          اصلاح خودکار همه
        </Button>
      </div>

      {value.length > 0 ? (
        <div className="space-y-2">
          {value.map((c, idx) => {
            const issues = whitelist.size ? validateHashtags(c, whitelist) : [];
            const hasIssues = issues.length > 0;

            return (
              <Card key={idx}>
                <div className="flex items-start justify-between gap-4">
                  <Button variant="ghost" onClick={() => removeAt(idx)}>
                    حذف
                  </Button>

                  <div className="min-w-0 flex-1">
                    <div className="whitespace-pre-wrap text-sm text-zinc-800" dir="auto">
                      {c}
                    </div>

                    {hasIssues ? (
                      <div className="mt-2 text-xs text-red-700">
                        هشتگ‌های نامعتبر:
                        {issues.map((i) => (
                          <span key={i.raw} className="me-2 font-mono" dir="ltr">
                            {i.raw}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      {allIssues.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <div className="mb-1 text-sm font-medium text-red-800">مشکلات هشتگ در کامنت‌ها</div>
          <div className="text-sm text-red-700">قبل از ساخت/ذخیره آیتم، این موارد را اصلاح کنید.</div>
        </div>
      ) : null}
    </div>
  );
}
