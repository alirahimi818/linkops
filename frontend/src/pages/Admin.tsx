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

type EditingDraft = {
  id: string;
  title: string;
  url: string;
  description: string;
  categoryId: string;
  selectedActionIds: string[];
  comments: string[];
};

export default function Admin() {
  const dateDefault = useMemo(() => todayYYYYMMDD(), []);
  const [date, setDate] = useState(dateDefault);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");

  const [availableActions, setAvailableActions] = useState<Action[]>([]);
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>([]);

  const [whitelist, setWhitelist] = useState<Set<string>>(new Set());

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");

  const [comments, setComments] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<EditingDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

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

  function openEditModal(i: any) {
    setError(null);

    const actionIds = Array.isArray(i.actions) ? i.actions.map((a: any) => a.id) : [];
    const commentStrings = mapItemCommentsToStrings(i.comments);

    setEditing({
      id: i.id,
      title: i.title ?? "",
      url: i.url ?? "",
      description: i.description ?? "",
      categoryId: i.category_id ?? "",
      selectedActionIds: actionIds,
      comments: commentStrings,
    });
  }

  function closeEditModal() {
    setEditing(null);
    setSavingEdit(false);
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

  async function onCreate() {
    setError(null);

    if (!title.trim() || !url.trim() || !description.trim()) return;

    if (whitelist.size > 0) {
      const issues = validateHashtags(comments.join("\n"), whitelist);
      if (issues.length > 0) {
        setError("قبل از ایجاد آیتم، لطفاً مشکلات هشتگ‌ها را در بخش کامنت‌ها برطرف کنید.");
        return;
      }
    }

    try {
      await adminCreateItem({
        date,
        title: title.trim(),
        url: url.trim(),
        description: description.trim(),
        category_id: categoryId ? categoryId : null,
        action_ids: selectedActionIds,
        comments,
      });

      setTitle("");
      setUrl("");
      setDescription("");
      setCategoryId("");
      setSelectedActionIds([]);
      setComments([]);

      await load();
    } catch (e: any) {
      setError(e?.message ?? "ایجاد آیتم ناموفق بود.");
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

  async function onSaveEdit() {
    if (!editing) return;

    setError(null);

    if (!editing.title.trim() || !editing.url.trim() || !editing.description.trim()) return;

    if (whitelist.size > 0) {
      const issues = validateHashtags(editing.comments.join("\n"), whitelist);
      if (issues.length > 0) {
        setError("قبل از ذخیره تغییرات، لطفاً مشکلات هشتگ‌ها را در بخش کامنت‌ها برطرف کنید.");
        return;
      }
    }

    setSavingEdit(true);
    try {
      await adminUpdateItem(editing.id, {
        title: editing.title.trim(),
        url: editing.url.trim(),
        description: editing.description.trim(),
        category_id: editing.categoryId ? editing.categoryId : null,
        action_ids: editing.selectedActionIds,
        comments: editing.comments,
      });

      closeEditModal();
      await load();
    } catch (e: any) {
      setError(e?.message ?? "ذخیره تغییرات ناموفق بود.");
    } finally {
      setSavingEdit(false);
    }
  }

  const createDisabled = !title.trim() || !url.trim() || !description.trim();

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

          <Textarea dir="auto" value={description} onChange={setDescription} placeholder="توضیح کوتاه" />

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

          <Button onClick={onCreate} disabled={createDisabled}>
            افزودن آیتم
          </Button>

          <div className="text-xs text-zinc-500">
            نکته: توضیح‌ها را کوتاه نگه دارید تا کاربران سریع‌تر پیش بروند.
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
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={() => onDelete(i.id)}>
                        حذف
                      </Button>

                      <Button variant="ghost" onClick={() => openEditModal(i)}>
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

      {editing ? (
        <Modal title="ویرایش آیتم" onClose={closeEditModal}>
          <div className="grid gap-3">
            <Input value={editing.title} onChange={(v) => setEditing({ ...editing, title: v })} placeholder="عنوان" />
            <Input
              dir="ltr"
              value={editing.url}
              onChange={(v) => setEditing({ ...editing, url: v })}
              placeholder="لینک (URL)"
            />

            <Select value={editing.categoryId} onChange={(v) => setEditing({ ...editing, categoryId: v })} dir="rtl">
              <option value="">دسته‌بندی (اختیاری)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>

            <Textarea
              dir="auto"
              value={editing.description}
              onChange={(v) => setEditing({ ...editing, description: v })}
              placeholder="توضیح کوتاه"
            />

            <ActionCheckboxes
              label="اکشن‌ها"
              actions={availableActions}
              value={editing.selectedActionIds}
              onChange={(next) => setEditing({ ...editing, selectedActionIds: next })}
              maxSelect={10}
              emptyHint="اکشنی برای انتخاب وجود ندارد."
            />

            <CommentsEditor
              label="کامنت‌های پیشنهادی (حداکثر ۵۰ مورد)"
              value={editing.comments}
              onChange={(next) => setEditing({ ...editing, comments: next })}
              whitelist={whitelist}
              maxItems={50}
              maxLen={280}
            />

            <div className="flex items-center gap-2 justify-start">
              <Button variant="secondary" onClick={onSaveEdit} disabled={savingEdit}>
                {savingEdit ? "در حال ذخیره…" : "ذخیره تغییرات"}
              </Button>
              <Button variant="ghost" onClick={closeEditModal} disabled={savingEdit}>
                بستن
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </PageShell>
  );
}

function Modal(props: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={props.onClose}>
      <div
        dir="rtl"
        className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <Button variant="ghost" onClick={props.onClose}>
            بستن
          </Button>
          <div className="text-lg font-semibold">{props.title}</div>
        </div>
        {props.children}
      </div>
    </div>
  );
}
