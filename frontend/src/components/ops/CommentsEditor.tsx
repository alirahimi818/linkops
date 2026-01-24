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

export default function CommentsEditor({
  label,
  value,
  onChange,
  whitelist,
  maxItems = 50,
  maxLen = 400,
}: Props) {
  const [draft, setDraft] = useState("");

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

      {draftIssues.length > 0 ? (
        <HashtagInspector
          title="مشکلات هشتگ در متن پیش‌نویس"
          text={draft}
          whitelist={whitelist}
          onReplaceText={setDraft}
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
          title="اصلاح خودکار غلط‌های قابل‌تبدیل در همه کامنت‌ها"
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
