import { useEffect, useMemo, useState } from "react";
import {
  adminCreateItem,
  adminDeleteItem,
  adminFetchItems,
  fetchActions,
  fetchCategories,
  fetchHashtagWhitelist,
} from "../lib/api";
import type { Action, Category, HashtagWhitelistRow, Item } from "../lib/api";
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

export default function Admin() {
  const dateDefault = useMemo(() => todayYYYYMMDD(), []);
  const [date, setDate] = useState(dateDefault);

  const [items, setItems] = useState<Item[]>([]);
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

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = `/login?next=${encodeURIComponent("/admin")}`;
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const it = await adminFetchItems(date);
      setItems(it);
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

  const createDisabled = !title.trim() || !url.trim() || !description.trim();

  return (
    <div dir="rtl" className="text-right">
      <PageShell
        header={
          <TopBar
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
            <Input value={url} onChange={setUrl} placeholder="لینک (URL)" />

            <Select value={categoryId} onChange={setCategoryId}>
              <option value="">دسته‌بندی (اختیاری)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>

            <Textarea value={description} onChange={setDescription} placeholder="توضیح کوتاه" />

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
              {items.map((i: any) => (
                <Card key={i.id}>
                  <div className="flex items-start justify-between gap-4">
                    <Button variant="secondary" onClick={() => onDelete(i.id)}>
                      حذف
                    </Button>

                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-semibold">{i.title}</div>

                      <a
                        className="mt-1 block truncate text-sm text-zinc-600 underline"
                        href={i.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {i.url}
                      </a>

                      <div className="mt-2 text-sm text-zinc-700">{i.description}</div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {i.category_name ? <Badge>{i.category_name}</Badge> : null}

                        {Array.isArray(i.actions)
                          ? i.actions.map((a: any) => (
                              <Badge key={a.id}>{a.label ?? a.name}</Badge>
                            ))
                          : null}

                        <span className="text-xs text-zinc-500">
                          توسط {i.created_by_username ?? "نامشخص"} •{" "}
                          {new Date(i.created_at).toLocaleString("fa-IR")}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </PageShell>
    </div>
  );
}