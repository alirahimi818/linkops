import { useEffect, useMemo, useState } from "react";
import {
  adminCreateItem,
  adminDeleteItem,
  adminFetchItems,
  adminUpdateItem,
  fetchActions,
  fetchCategories,
  fetchHashtagWhitelist,
} from "../lib/api";
import type { Action, Category, HashtagWhitelistRow } from "../lib/api";
import { todayYYYYMMDD } from "../lib/date";

import PageShell from "../components/layout/PageShell";
import TopBar from "../components/layout/TopBar";

import DatePicker from "../components/ui/DatePicker";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import Badge from "../components/ui/Badge";
import Select from "../components/ui/Select";
import Alert from "../components/ui/Alert";

import ActionCheckboxes from "../components/ops/ActionCheckboxes";
import CommentsEditor from "../components/ops/CommentsEditor";
import { validateHashtags } from "../lib/hashtags";

const TOKEN_KEY = "admin:jwt";

type ItemComment = { id: string; text: string; created_at: string };

type EditState = {
  id: string;
  originalDate: string;
};

export default function Admin() {
  const dateDefault = useMemo(() => todayYYYYMMDD(), []);
  const [date, setDate] = useState(dateDefault);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [availableActions, setAvailableActions] = useState<Action[]>([]);
  const [whitelist, setWhitelist] = useState<Set<string>>(new Set());

  // Form fields (shared for create/edit)
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>([]);
  const [comments, setComments] = useState<string[]>([]);

  // Edit mode
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  // UI state
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = `/login?next=${encodeURIComponent("/admin")}`;
  }

  function toggleComments(id: string) {
    setOpenComments((p) => ({ ...p, [id]: !p[id] }));
  }

  function mapItemCommentsToStrings(c: any): string[] {
    if (!c) return [];
    if (Array.isArray(c) && c.length > 0 && typeof c[0] === "string") return c;
    if (Array.isArray(c)) return (c as ItemComment[]).map((x) => x.text);
    return [];
  }

  function resetForm() {
    setTitle("");
    setUrl("");
    setDescription("");
    setCategoryId("");
    setSelectedActionIds([]);
    setComments([]);
    setEditing(null);
  }

  function startEdit(i: any) {
    setError(null);

    setTitle(i.title ?? "");
    setUrl(i.url ?? "");
    setDescription(i.description ?? "");
    setCategoryId(i.category_id ?? "");
    setSelectedActionIds(Array.isArray(i.actions) ? i.actions.map((a: any) => a.id) : []);
    setComments(mapItemCommentsToStrings(i.comments));

    setEditing({ id: i.id, originalDate: i.date ?? date });

    // Optional: scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const it = await adminFetchItems(date);
      setItems(it as any[]);
    } catch (e: any) {
      setError(e?.message ?? "بارگذاری آیتم‌ها ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }

  async function bootstrap() {
    try {
      const [cats, tags, acts] = await Promise.all([
        fetchCategories(),
        fetchHashtagWhitelist(),
        fetchActions(),
      ]);

      setCategories(cats);
      setAvailableActions(acts);

      const active = (tags as HashtagWhitelistRow[])
        .filter((t) => t.is_active === 1)
        .map((t) => t.tag.toLowerCase());
      setWhitelist(new Set(active));
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("bootstrap failed:", e);
    }
  }

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  function validateBeforeSave(currentComments: string[]) {
    if (whitelist.size === 0) return null;
    const issues = validateHashtags(currentComments.join("\n"), whitelist);
    if (issues.length > 0) return "قبل از ذخیره، لطفاً مشکلات هشتگ‌ها را در بخش کامنت‌ها برطرف کنید.";
    return null;
  }

  async function onSubmit() {
    setError(null);

    if (!title.trim() || !url.trim() || !description.trim()) return;

    const msg = validateBeforeSave(comments);
    if (msg) {
      setError(msg);
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await adminUpdateItem(editing.id, {
          title: title.trim(),
          url: url.trim(),
          description: description.trim(),
          category_id: categoryId ? categoryId : null,
          action_ids: selectedActionIds,
          comments,
        });
      } else {
        await adminCreateItem({
          date,
          title: title.trim(),
          url: url.trim(),
          description: description.trim(),
          category_id: categoryId ? categoryId : null,
          action_ids: selectedActionIds,
          comments,
        });
      }

      resetForm();
      await load();
    } catch (e: any) {
      setError(e?.message ?? (editing ? "ذخیره تغییرات ناموفق بود." : "ایجاد آیتم ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    setError(null);
    try {
      await adminDeleteItem(id);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "حذف آیتم ناموفق بود.");
    }
  }

  const submitDisabled = !title.trim() || !url.trim() || !description.trim() || saving;

  return (
    <PageShell
      dir="rtl"
      header={
        <TopBar
          dir="rtl"
          title="مدیریت"
          subtitle="آیتم‌های روزانه را اضافه و مدیریت کنید."
          right={
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={logout}>
                خروج
              </Button>
              <DatePicker value={date} onChange={setDate} />
              <span className="text-sm text-zinc-600">تاریخ</span>
            </div>
          }
        />
      }
      footer={
        <>
          بازگشت به{" "}
          <a className="underline" href="/">
            صفحه اصلی
          </a>
        </>
      }
    >
      {error ? (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      ) : null}

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm text-zinc-600">
            {editing ? (
              <span>
                در حال ویرایش آیتم <span className="font-mono" dir="ltr">{editing.id}</span>
              </span>
            ) : (
              <span>ایجاد آیتم جدید برای تاریخ {date}</span>
            )}
          </div>

          {editing ? (
            <Button variant="ghost" onClick={resetForm} disabled={saving}>
              انصراف از ویرایش
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3">
          <Input value={title} onChange={setTitle} placeholder="عنوان" />
          <Input dir="ltr" value={url} onChange={setUrl} placeholder="لینک (URL)" />

          <Select value={categoryId} onChange={setCategoryId} dir="rtl">
            <option value="">دسته‌بندی (اختیاری)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          <Textarea
            dir="rtl"
            textDir="auto"
            value={description}
            onChange={setDescription}
            placeholder="توضیح کوتاه"
          />

          <ActionCheckboxes
            label="اکشن‌ها"
            actions={availableActions}
            value={selectedActionIds}
            onChange={setSelectedActionIds}
            maxSelect={10}
            emptyHint="اکشنی برای انتخاب وجود ندارد."
          />

          <CommentsEditor
            label="کامنت‌های پیشنهادی (حداکثر ۵۰ مورد)"
            value={comments}
            onChange={setComments}
            whitelist={whitelist}
            maxItems={50}
            maxLen={280}
          />

          <div className="flex items-center gap-2">
            <Button onClick={onSubmit} disabled={submitDisabled}>
              {editing ? (saving ? "در حال ذخیره…" : "ذخیره تغییرات") : saving ? "در حال افزودن…" : "افزودن آیتم"}
            </Button>

            {!editing ? (
              <div className="text-xs text-zinc-500">
                نکته: توضیح‌ها را کوتاه نگه دارید تا کاربران سریع‌تر پیش بروند.
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <section className="mt-6">
        <div className="mb-3 text-sm text-zinc-500">آیتم‌های تاریخ {date}</div>

        {loading ? (
          <div className="text-zinc-500">در حال بارگذاری…</div>
        ) : items.length === 0 ? (
          <Card className="p-6 text-zinc-600">هنوز آیتمی ثبت نشده است.</Card>
        ) : (
          <div className="space-y-3">
            {items.map((i: any) => {
              const commentStrings = mapItemCommentsToStrings(i.comments);
              const hasComments = commentStrings.length > 0;
              const isOpen = !!openComments[i.id];

              return (
                <Card key={i.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col justify-center items-center gap-2">
                      <Button variant="secondary" onClick={() => onDelete(i.id)}>
                        حذف
                      </Button>

                      <Button variant="ghost" onClick={() => startEdit(i)}>
                        ویرایش
                      </Button>

                      <Button
                        variant="ghost"
                        onClick={() => toggleComments(i.id)}
                        disabled={!hasComments}
                        title={!hasComments ? "کامنتی ثبت نشده است" : undefined}
                      >
                        {isOpen ? "بستن کامنت‌ها" : `کامنت‌ها (${commentStrings.length})`}
                      </Button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-semibold">{i.title}</div>

                      <a
                        className="mt-1 block truncate text-sm text-zinc-600 underline"
                        href={i.url}
                        target="_blank"
                        rel="noreferrer"
                        dir="ltr"
                      >
                        {i.url}
                      </a>

                      <div className="mt-2 text-sm text-zinc-700" dir="auto">
                        {i.description}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {i.category_name ? <Badge>{i.category_name}</Badge> : null}

                        {Array.isArray(i.actions)
                          ? i.actions.map((a: any) => <Badge key={a.id}>{a.label ?? a.name}</Badge>)
                          : null}

                        <span className="text-xs text-zinc-500">
                          توسط {i.created_by_username ?? "نامشخص"} •{" "}
                          {new Date(i.created_at).toLocaleString("fa-IR")}
                        </span>
                      </div>

                      {isOpen && hasComments ? (
                        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                          <div className="mb-2 text-sm font-medium text-zinc-800">کامنت‌های پیشنهادی</div>

                          <div className="space-y-2">
                            {commentStrings.map((c, idx) => (
                              <div
                                key={idx}
                                className="rounded-lg border border-zinc-200 bg-white p-3 text-sm whitespace-pre-wrap"
                                dir="auto"
                              >
                                {c}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </PageShell>
  );
}
