import { useMemo, useState } from "react";
import Textarea from "../ui/Textarea";
import Button from "../ui/Button";
import Card from "../ui/Card";
import {
  applySuggestedReplacements,
  type HashtagIssue,
  validateHashtags,
} from "../../lib/hashtags";
import HashtagInspector from "../ops/HashtagInspector";
import BulkCommentImport from "../ops/BulkCommentImport";
import CleanSinglePasteHint from "../ops/CleanSinglePasteHint";
import { extractCommentsFromPastedText } from "../../lib/commentPaste";

export type CommentDraft = {
  text: string;
  translation_text?: string | null;
};

type Props = {
  label?: string;
  value: CommentDraft[];
  onChange: (next: CommentDraft[]) => void;
  whitelist: Set<string>; // normalized tags without '#'
  maxItems?: number;
  maxLen?: number;
};

function normalizeComment(s: string, maxLen: number) {
  return s.trim().slice(0, maxLen);
}

function collectIssuesForComments(
  comments: CommentDraft[],
  whitelist: Set<string>,
): HashtagIssue[] {
  if (comments.length === 0 || whitelist.size === 0) return [];
  const out: HashtagIssue[] = [];
  for (const c of comments) out.push(...validateHashtags(c.text, whitelist));
  return out;
}

function autoFixComment(comment: string, whitelist: Set<string>): string {
  if (whitelist.size === 0) return comment;
  const issues = validateHashtags(comment, whitelist);
  return applySuggestedReplacements(comment, issues);
}

function removeDanglingHashtags(text: string) {
  let s = String(text ?? "");

  // Remove a standalone '#' that is followed by whitespace/end/punctuation
  // Examples: "# " , "#\n", "#.", "#," , "#)" , "#—"
  s = s.replace(/(^|\s)#(?=\s|$|[.,;:!?)\]}>"'،؛…—–])/gu, "$1");

  // Also remove trailing lone '#'
  s = s.replace(/#\s*$/gu, "");

  // Collapse spaces again
  s = s.replace(/[ \t]{2,}/g, " ").trim();

  return s;
}

function stripDirectionMarks(s: string) {
  return String(s ?? "").replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");
}

/**
 * Remove unknown hashtags after replacements.
 */
function pruneUnknownHashtags(text: string, whitelist: Set<string>) {
  if (whitelist.size === 0) return text;

  text = stripDirectionMarks(text);
  
  const out = text.replace(/(^|\s)#([\p{L}\p{N}_]+)/gu, (_full, lead, tag) => {
    const t = String(tag ?? "").trim();
    if (!t) return lead;
    if (whitelist.has(t)) return `${lead}#${t}`;
    return lead; // remove unknown hashtag completely
  });

  return removeDanglingHashtags(out)
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
 */
function damerauLevenshteinWithin(a: string, b: string, maxDist: number) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;

  const al = a.length;
  const bl = b.length;

  const dp: number[][] = Array.from({ length: al + 1 }, () =>
    new Array(bl + 1).fill(0),
  );
  for (let i = 0; i <= al; i++) dp[i][0] = i;
  for (let j = 0; j <= bl; j++) dp[0][j] = j;

  for (let i = 1; i <= al; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      let val = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );

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

  const maxDist = q.length <= 4 ? 1 : 2;
  const dist = damerauLevenshteinWithin(
    q,
    c.slice(0, Math.max(q.length, Math.min(c.length, q.length + 2))),
    maxDist,
  );

  if (dist <= maxDist) return 500 - dist * 50 - Math.min(200, c.length);
  return -Infinity;
}

function buildHashtagSuggestions(
  fragment: string,
  whitelist: Set<string>,
  limit = 12,
) {
  const q = fragment.trim();
  if (q.length < 2) return [];

  const all = Array.from(whitelist);

  return all
    .map((t) => ({ t, score: scoreCandidate(q, t) }))
    .filter((x) => Number.isFinite(x.score) && x.score > -Infinity)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.t);
}

function replaceActiveHashtag(text: string, nextTag: string) {
  return text.replace(/(^|\s)#([^\s#]{1,80})$/u, `$1#${nextTag}`);
}

function hasNonEmptyTranslation(c: CommentDraft) {
  return (
    typeof c.translation_text === "string" &&
    c.translation_text.trim().length > 0
  );
}

export default function CommentsEditor({
  label,
  value,
  onChange,
  whitelist,
  maxItems = 50,
  maxLen = 400,
}: Props) {
  // Draft editor (create/edit)
  const [draftText, setDraftText] = useState("");
  const [draftTranslation, setDraftTranslation] = useState("");
  const [showTranslation, setShowTranslation] = useState(false);

  // If editing, we keep the original index so we can replace in same position (optional)
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const activeFrag = useMemo(
    () => getActiveHashtagFragment(draftText),
    [draftText],
  );

  const suggestions = useMemo(() => {
    if (!activeFrag) return [];
    return buildHashtagSuggestions(activeFrag.fragment, whitelist, 12);
  }, [activeFrag, whitelist]);

  const draftIssues = useMemo(() => {
    if (!draftText.trim() || whitelist.size === 0) return [];
    return validateHashtags(draftText, whitelist);
  }, [draftText, whitelist]);

  const allIssues = useMemo(() => {
    return collectIssuesForComments(value, whitelist);
  }, [value, whitelist]);

  // Bulk extraction (list markers -> items)
  const extracted = useMemo(() => {
    return extractCommentsFromPastedText(draftText);
  }, [draftText]);

  const bulkCandidates = useMemo(() => {
    return extracted.length >= 2 ? extracted : [];
  }, [extracted]);

  const singleCleaned = useMemo(() => {
    return extracted.length === 1 ? extracted[0] : null;
  }, [extracted]);

  const hasBulkMode = bulkCandidates.length > 0;

  const canAddOrSave =
    !hasBulkMode &&
    draftText.trim().length > 0 &&
    value.length < maxItems &&
    (editingIndex !== null || value.length < maxItems);

  function resetDraft() {
    setDraftText("");
    setDraftTranslation("");
    setShowTranslation(false);
    setEditingIndex(null);
  }

  function addOrSave() {
    if (hasBulkMode) return;
    if (!draftText.trim()) return;

    const t = normalizeComment(draftText, maxLen);
    if (!t) return;

    const tr = draftTranslation.trim();
    const draft: CommentDraft = {
      text: t,
      translation_text: showTranslation
        ? tr
          ? tr.slice(0, maxLen)
          : null
        : null,
    };

    // If editing -> replace at index
    if (editingIndex !== null) {
      const next = value.slice();
      next.splice(editingIndex, 0, draft); // insert back at the same position
      onChange(next);
      resetDraft();
      return;
    }

    // Create
    if (value.length >= maxItems) return;
    onChange([...value, draft]);
    resetDraft();
  }

  function addBulk() {
    if (bulkCandidates.length === 0) return;

    const room = Math.max(0, maxItems - value.length);
    if (room <= 0) return;

    const picked = bulkCandidates.slice(0, room).map((t) => ({
      text: normalizeComment(t, maxLen),
      translation_text: null,
    }));

    // Optional: auto-fix/prune hashtags while importing
    const next = picked.map((c) => ({
      ...c,
      text: pruneUnknownHashtags(autoFixComment(c.text, whitelist), whitelist),
    }));

    onChange([...value, ...next]);
    resetDraft();
  }

  function applyCleanSingle(next: string) {
    setDraftText(next);
  }

  function removeAt(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function startEdit(idx: number) {
    const c = value[idx];
    const next = value.filter((_, i) => i !== idx);

    onChange(next);

    setDraftText(c.text ?? "");
    const tr = typeof c.translation_text === "string" ? c.translation_text : "";
    setDraftTranslation(tr);
    setShowTranslation(tr.trim().length > 0);
    setEditingIndex(idx);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    // Put back draft into list if user cancels edit
    if (editingIndex === null) {
      resetDraft();
      return;
    }

    const t = draftText.trim();
    if (t) {
      const tr = draftTranslation.trim();
      const draft: CommentDraft = {
        text: normalizeComment(draftText, maxLen),
        translation_text: showTranslation
          ? tr
            ? tr.slice(0, maxLen)
            : null
          : null,
      };

      const next = value.slice();
      next.splice(editingIndex, 0, draft);
      onChange(next);
    }

    resetDraft();
  }

  function replaceAll() {
    if (whitelist.size === 0 || value.length === 0) return;

    const next = value
      .slice(0, maxItems)
      .map((c) => ({
        ...c,
        text: pruneUnknownHashtags(
          autoFixComment(c.text, whitelist),
          whitelist,
        ).trim(),
      }))
      .filter((c) => c.text.length > 0);

    onChange(next);
  }

  return (
    <div dir="rtl" className="grid gap-2 text-right">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-zinc-800">
          {label ?? "کامنت‌های پیشنهادی"}
        </div>
        <div className="text-xs text-zinc-500">
          {value.length} / {maxItems}
        </div>
      </div>

      {/* Draft editor */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-zinc-600">
            {editingIndex !== null ? "ویرایش کامنت" : "افزودن کامنت جدید"}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowTranslation((s) => !s)}
              disabled={!draftText.trim() && editingIndex === null}
              title="Toggle translation"
            >
              {showTranslation ? "بستن ترجمه" : "افزودن ترجمه"}
            </Button>

            {editingIndex !== null ? (
              <Button variant="ghost" onClick={cancelEdit}>
                انصراف از ویرایش
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 grid gap-3">
          <Textarea
            dir="auto"
            value={draftText}
            onChange={setDraftText}
            placeholder="کامنت را بنویسید (Enter برای افزودن/ذخیره، Shift+Enter برای خط جدید)."
            onKeyDown={(e: any) => {
              if (e.key === "Enter" && !e.shiftKey) {
                // Prevent accidental single-add when a bulk list is present
                if (hasBulkMode) {
                  e.preventDefault();
                  return;
                }
                e.preventDefault();
                addOrSave();
              }
            }}
          />

          {/* Bulk import UI */}
          <BulkCommentImport
            candidates={bulkCandidates}
            onAddAll={addBulk}
            onClear={resetDraft}
          />

          {/* Single paste cleanup hint */}
          <CleanSinglePasteHint
            cleaned={singleCleaned}
            original={draftText}
            onApply={applyCleanSingle}
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
                    onClick={() =>
                      setDraftText((prev) => replaceActiveHashtag(prev, t))
                    }
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
              title="مشکلات هشتگ در متن"
              text={draftText}
              whitelist={whitelist}
              onReplaceText={setDraftText}
              pruneUnknownOnReplace
            />
          ) : null}

          {showTranslation ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <div className="mb-2 text-xs font-medium text-zinc-700">
                ترجمه (اختیاری)
              </div>
              <Textarea
                className="w-full"
                dir="rtl"
                value={draftTranslation}
                onChange={setDraftTranslation}
                placeholder="ترجمه فارسی را وارد کنید (در صورت نیاز)"
              />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3">
            <Button variant="info" onClick={addOrSave} disabled={!canAddOrSave}>
              {editingIndex !== null
                ? "ذخیره و بازگشت به لیست"
                : "افزودن کامنت"}
            </Button>

            <Button
              variant="warning"
              onClick={replaceAll}
              disabled={value.length === 0 || whitelist.size === 0}
              title="اصلاح خودکار غلط‌های قابل‌تبدیل + حذف هشتگ‌های ناشناخته در همه کامنت‌ها (فقط متن اصلی)"
            >
              اصلاح خودکار همه
            </Button>
          </div>
        </div>
      </Card>

      {/* List */}
      {value.length > 0 ? (
        <div className="space-y-2">
          {value.map((c, idx) => {
            const issues = whitelist.size
              ? validateHashtags(c.text, whitelist)
              : [];
            const hasIssues = issues.length > 0;

            return (
              <Card key={idx}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col justify-center items-center gap-2">
                    <Button
                      className="w-full"
                      variant="danger"
                      onClick={() => removeAt(idx)}
                    >
                      حذف
                    </Button>

                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={() => startEdit(idx)}
                    >
                      ویرایش
                    </Button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div
                        className="whitespace-pre-wrap text-sm text-zinc-800"
                        dir="auto"
                      >
                        {c.text}
                      </div>
                    </div>

                    {hasIssues ? (
                      <div className="mt-2 text-xs text-red-700">
                        هشتگ‌های نامعتبر:
                        {issues.map((i) => (
                          <span
                            key={i.raw}
                            className="me-2 font-mono"
                            dir="ltr"
                          >
                            {i.raw}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {hasNonEmptyTranslation(c) ? (
                      <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                        <div className="mb-1 text-xs font-medium text-zinc-700">
                          ترجمه
                        </div>
                        <div className="whitespace-pre-wrap text-sm text-zinc-700">
                          {c.translation_text}
                        </div>
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
          <div className="mb-1 text-sm font-medium text-red-800">
            مشکلات هشتگ در کامنت‌ها
          </div>
          <div className="text-sm text-red-700">
            قبل از ساخت/ذخیره آیتم، این موارد را اصلاح کنید.
          </div>
        </div>
      ) : null}
    </div>
  );
}
