import type { Action, Category } from "../../../lib/api";

import Card from "../../ui/Card";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Textarea from "../../ui/Textarea";
import Select from "../../ui/Select";
import Alert from "../../ui/Alert";

import ActionCheckboxes from "../ActionCheckboxes";
import CommentsEditor from "../CommentsEditor";

import { validateHashtags } from "../../../lib/hashtags";
import {
  autoCategoryIdFromUrl,
  autoFixUrl,
  isValidAbsoluteHttpUrl,
} from "../../../lib/adminItemUtils";

export type EditState = { id: string; originalDate: string } | null;

export default function AdminItemForm(props: {
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

  comments: string[];
  setComments: (v: string[]) => void;

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
  function validateBeforeSave(currentComments: string[]) {
    if (props.whitelist.size === 0) return null;
    const issues = validateHashtags(currentComments.join("\n"), props.whitelist);
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

    if (!props.title.trim() || !props.url.trim() || !props.description.trim()) return;

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

          <Input value={props.title} onChange={props.setTitle} placeholder="عنوان" />

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
          />

          <div className="flex flex-wrap items-center gap-2 border-t pt-3 border-zinc-200">
            <Button variant="success" onClick={handleSubmit} disabled={submitDisabled}>
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