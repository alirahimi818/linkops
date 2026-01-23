import { useMemo, useState } from "react";
import Textarea from "../ui/Textarea";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { applySuggestedReplacements, type HashtagIssue, validateHashtags } from "../../lib/hashtags";

type Props = {
  label?: string;
  value: string[];
  onChange: (next: string[]) => void;
  whitelist: Set<string>; // normalized tags without '#'
  maxItems?: number;
  maxLen?: number;
};

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
    if (value.length === 0 || whitelist.size === 0) return [];
    return validateHashtags(value.join("\n"), whitelist);
  }, [value, whitelist]);

  function addDraft() {
    const t = draft.trim().slice(0, maxLen);
    if (!t) return;
    if (value.length >= maxItems) return;

    onChange([...value, t]);
    setDraft("");
  }

  function removeAt(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function replaceDraft() {
    const replaced = applySuggestedReplacements(draft, draftIssues);
    setDraft(replaced);
  }

  function replaceAll() {
    const joined = value.join("\n");
    const issues = validateHashtags(joined, whitelist);
    const replaced = applySuggestedReplacements(joined, issues);
    const next = replaced
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, maxItems);
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
        <IssueBox title="مشکلات هشتگ در متن پیش‌نویس" issues={draftIssues} onReplace={replaceDraft} />
      ) : null}

      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={addDraft} disabled={!draft.trim() || value.length >= maxItems}>
          افزودن کامنت
        </Button>

        <Button
          variant="ghost"
          onClick={replaceAll}
          disabled={value.length === 0 || whitelist.size === 0}
          title="اصلاح خودکار غلط‌های قابل‌تبدیل در همه کامنت‌ها"
        >
          اصلاح خودکار همه
        </Button>
      </div>

      {value.length > 0 ? (
        <div className="space-y-2">
          {value.map((c, idx) => (
            <Card key={idx}>
              <div className="flex items-start justify-between gap-4">
                <Button variant="ghost" onClick={() => removeAt(idx)}>
                  حذف
                </Button>

                <div className="min-w-0 flex-1">
                  <div className="whitespace-pre-wrap text-sm text-zinc-800" dir="auto">
                    {c}
                  </div>

                  {whitelist.size ? (
                    (() => {
                      const issues = validateHashtags(c, whitelist);
                      return issues.length > 0 ? (
                        <div className="mt-2 text-xs text-red-700">
                          هشتگ‌های نامعتبر:
                          {issues.map((i) => (
                            <span key={i.raw} className="me-2 font-mono" dir="ltr">
                              {i.raw}
                            </span>
                          ))}
                        </div>
                      ) : null;
                    })()
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {allIssues.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <div className="mb-1 text-sm font-medium text-red-800">مشکلات هشتگ در کامنت‌ها</div>
          <div className="text-sm text-red-700">قبل از ساخت آیتم، این موارد را اصلاح کنید.</div>
        </div>
      ) : null}
    </div>
  );
}

function IssueBox(props: { title: string; issues: HashtagIssue[]; onReplace: () => void }) {
  const hasSuggestion = props.issues.some((i) => !!i.suggestion);

  return (
    <div dir="rtl" className="rounded-xl border border-red-200 bg-red-50 p-3 text-right">
      <div className="mb-2 text-sm font-medium text-red-800">{props.title}</div>

      <ul className="list-disc ps-5 text-sm text-red-700">
        {props.issues.map((i, idx) => (
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

      {hasSuggestion ? (
        <div className="mt-3">
          <Button variant="secondary" onClick={props.onReplace}>
            جایگزینی
          </Button>
        </div>
      ) : null}
    </div>
  );
}
