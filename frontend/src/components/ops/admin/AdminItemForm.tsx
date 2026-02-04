import { useState } from "react";
import type { Action, Category, Tone } from "../../../lib/api";

import Card from "../../ui/Card";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Textarea from "../../ui/Textarea";
import Select from "../../ui/Select";
import Alert from "../../ui/Alert";

import ActionCheckboxes from "../ActionCheckboxes";
import CommentsEditor, { type CommentDraft } from "../CommentsEditor";

import { validateHashtags } from "../../../lib/hashtags";
import {
  autoCategoryIdFromUrl,
  autoFixUrl,
  isValidAbsoluteHttpUrl,
} from "../../../lib/adminItemUtils";

import { adminGenerateAIComments } from "../../../lib/api";

export type EditState = { id: string; originalDate: string } | null;

export default function AdminItemForm(props: {
  itemId: string | null;

  date: string;

  categories: Category[];
  actions: Action[];
  whitelist: Set<string>;

  // shared fields
  title: string;
  setTitle: (v: string) => void;

  url: string;
  setUrl: (v: string) => void;

  description: string;
  setDescription: (v: string) => void;

  categoryId: string;
  setCategoryId: (v: string) => void;

  selectedActionIds: string[];
  setSelectedActionIds: (v: string[]) => void;

  comments: CommentDraft[];
  setComments: (v: CommentDraft[]) => void;

  // global
  isGlobal: boolean;
  setIsGlobal: (v: boolean) => void;

  // edit mode
  editing: EditState;
  saving: boolean;

  // UX control for auto-category
  categoryTouched: boolean;
  setCategoryTouched: (v: boolean) => void;
  setCategoryIdProgrammatically: (v: string) => void;

  // error
  error: string | null;
  setError: (v: string | null) => void;

  // actions
  onSubmit: (fixedUrl: string) => Promise<void>;
  onCancelEdit: () => void;
}) {
  function validateBeforeSave(currentComments: CommentDraft[]) {
    if (props.whitelist.size === 0) return null;

    const text = currentComments
      .map((c) => String(c?.text ?? "").trim())
      .filter(Boolean)
      .join("\n");

    const issues = validateHashtags(text, props.whitelist);
    if (issues.length > 0)
      return "قبل از ذخیره، لطفاً مشکلات هشتگ‌ها را در بخش کامنت‌ها برطرف کنید.";

    return null;
  }

  function autoSelectCategoryByUrl(nextUrlRaw: string) {
    if (props.categoryTouched) return;
    const id = autoCategoryIdFromUrl(props.categories, nextUrlRaw);
    if (id) props.setCategoryIdProgrammatically(id);
  }

  async function handleSubmit() {
    props.setError(null);

    if (!props.title.trim() || !props.url.trim() || !props.description.trim())
      return;

    const fixedUrl = autoFixUrl(props.url);
    if (fixedUrl !== props.url) props.setUrl(fixedUrl);

    if (!isValidAbsoluteHttpUrl(fixedUrl)) {
      props.setError("لطفاً لینک را کامل وارد کنید (با http:// یا https://).");
      return;
    }

    const msg = validateBeforeSave(props.comments);
    if (msg) {
      props.setError(msg);
      return;
    }

    await props.onSubmit(fixedUrl.trim());
  }

  const submitDisabled =
    !props.title.trim() ||
    !props.url.trim() ||
    !props.description.trim() ||
    props.saving ||
    !isValidAbsoluteHttpUrl(autoFixUrl(props.url));

  // AI section

  const [aiTone, setAiTone] = useState<Tone>("neutral");
  const [aiNeedFa, setAiNeedFa] = useState(
    "تولید ریپلای‌های کوتاه برای تعامل و ادامه گفتگو",
  );
  const [aiCommentTypeFa, setAiCommentTypeFa] = useState("ریپلای کوتاه");

  const [aiExamplesMode, setAiExamplesMode] = useState<
    "random_existing" | "manual" | "none"
  >("random_existing");

  const [aiManualExamplesText, setAiManualExamplesText] = useState("");

  // Save directly or only preview
  const [aiSaveToDb, setAiSaveToDb] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function handleAIGenerate() {
    props.setError(null);
    setAiError(null);

    if (!props.itemId) {
      setAiError(
        "برای تولید با AI، ابتدا آیتم را ذخیره کنید (بعد وارد حالت ویرایش شوید).",
      );
      return;
    }

    if (!props.title.trim() || !props.description.trim()) {
      setAiError("برای تولید با AI، عنوان و توضیح را وارد کنید.");
      return;
    }

    let examples: Array<{ text: string }> = [];

    if (aiExamplesMode === "random_existing") {
      const pool = props.comments
        .map((c) => String(c.text || "").trim())
        .filter((t) => t.length > 0);

      examples = pickRandom(pool, 5).map((t) => ({ text: t }));
    } else if (aiExamplesMode === "manual") {
      examples = parseManualExamples(aiManualExamplesText);

      if (examples.length === 0) {
        setAiError(
          "برای حالت مثال دستی، لطفاً حداقل ۱ خط مثال انگلیسی وارد کنید.",
        );
        return;
      }
    }

    function pickRandom<T>(arr: T[], count: number): T[] {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a.slice(0, count);
    }

    function parseManualExamples(text: string): Array<{ text: string }> {
      return String(text || "")
        .split(/\r?\n/g)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 5)
        .map((t) => ({ text: t }));
    }

    setAiLoading(true);
    try {
      const res = await adminGenerateAIComments({
        item_id: props.itemId,
        title_fa: props.title.trim(),
        description_fa: props.description.trim(),
        need_fa: aiNeedFa.trim(),
        comment_type_fa: aiCommentTypeFa.trim(),
        tone: aiTone,
        examples,
        save: aiSaveToDb,
        count: 10,
      });

      // Append to local draft list (max 50)
      const incoming = (res.comments || []).map((c) => ({
        text: c.text,
        translation_text: c.translation_text,
      }));

      const maxItems = 50;
      const space = Math.max(0, maxItems - props.comments.length);
      const toAdd = incoming.slice(0, space);

      if (toAdd.length > 0) {
        props.setComments([...props.comments, ...toAdd]);
      } else {
        setAiError(
          "لیست کامنت‌ها پر است (حداکثر ۵۰). ابتدا چند مورد را حذف کنید.",
        );
      }
    } catch (e: any) {
      setAiError(e?.message ?? "تولید کامنت با AI ناموفق بود.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <>
      {props.error ? (
        <Alert variant="error" className="mb-6">
          {props.error}
        </Alert>
      ) : null}

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm text-zinc-600">
            {props.editing ? (
              <span>
                در حال ویرایش آیتم{" "}
                <span className="font-mono" dir="ltr">
                  {props.editing.id}
                </span>
              </span>
            ) : (
              <span>ایجاد آیتم جدید برای تاریخ {props.date}</span>
            )}
          </div>

          {props.editing ? (
            <Button
              variant="secondary"
              onClick={props.onCancelEdit}
              disabled={props.saving}
            >
              انصراف از ویرایش
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3">
          {/* Global toggle */}
          <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-zinc-900">
                آیتم همیشگی (Global)
              </div>
              <div className="mt-0.5 text-xs text-zinc-600">
                اگر فعال باشد، این آیتم در همه روزها نمایش داده می‌شود و وضعیت
                انجام‌شدن آن سراسری خواهد بود.
              </div>
            </div>

            <input
              type="checkbox"
              className="h-5 w-5 accent-zinc-900"
              checked={props.isGlobal}
              onChange={(e) => props.setIsGlobal(e.target.checked)}
              disabled={props.saving}
              aria-label="Global item"
            />
          </label>

          <Input
            value={props.title}
            onChange={props.setTitle}
            placeholder="عنوان"
          />

          <Input
            dir="ltr"
            value={props.url}
            onChange={(v) => {
              props.setUrl(v);
              autoSelectCategoryByUrl(v);
            }}
            placeholder="لینک (URL)"
          />

          <Select
            value={props.categoryId}
            onChange={(v) => {
              props.setCategoryId(v);
              props.setCategoryTouched(true);
            }}
            dir="rtl"
          >
            <option value="">دسته‌بندی (اختیاری)</option>
            {props.categories.map((c) => (
              <option key={(c as any).id} value={(c as any).id}>
                {(c as any).name}
              </option>
            ))}
          </Select>

          <Textarea
            dir="auto"
            value={props.description}
            onChange={props.setDescription}
            placeholder="توضیح کوتاه"
          />

          <ActionCheckboxes
            label="اکشن‌ها"
            actions={props.actions}
            value={props.selectedActionIds}
            onChange={props.setSelectedActionIds}
            maxSelect={10}
            emptyHint="اکشنی برای انتخاب وجود ندارد."
          />

          <CommentsEditor
            label="کامنت‌های پیشنهادی (حداکثر ۵۰ مورد)"
            value={props.comments}
            onChange={props.setComments}
            whitelist={props.whitelist}
            maxItems={50}
            maxLen={1000}
            ai={{
              enabled: !!props.itemId,
              loading: aiLoading,
              error: aiError,

              tone: aiTone,
              setTone: setAiTone,

              need_fa: aiNeedFa,
              setNeedFa: setAiNeedFa,

              comment_type_fa: aiCommentTypeFa,
              setCommentTypeFa: setAiCommentTypeFa,

              examplesMode: aiExamplesMode,
              setExamplesMode: setAiExamplesMode,
              manualExamplesText: aiManualExamplesText,
              setManualExamplesText: setAiManualExamplesText,

              saveToDb: aiSaveToDb,
              setSaveToDb: setAiSaveToDb,

              onGenerate: handleAIGenerate,
            }}
          />

          <div className="flex flex-wrap items-center gap-2 border-t pt-3 border-zinc-200">
            <Button
              variant="success"
              onClick={handleSubmit}
              disabled={submitDisabled}
            >
              {props.editing
                ? props.saving
                  ? "در حال ذخیره…"
                  : "ذخیره تغییرات"
                : props.saving
                  ? "در حال افزودن…"
                  : "افزودن آیتم"}
            </Button>

            {!props.editing ? (
              <div className="text-xs text-zinc-500">
                نکته: توضیح‌ها را کوتاه نگه دارید تا کاربران سریع‌تر پیش بروند.
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    </>
  );
}
