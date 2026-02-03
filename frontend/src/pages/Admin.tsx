import { useEffect, useMemo, useRef, useState } from "react";
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

import AdminHeaderBar from "../components/ops/admin/AdminHeaderBar";
import AdminItemForm from "../components/ops/admin/AdminItemForm";
import AdminItemList from "../components/ops/admin/AdminItemList";
import AdminProfilePanel from "../components/ops/admin/AdminProfilePanel";

import {
  autoFixUrl,
  autoCategoryIdFromUrl,
  mapItemCommentsToDrafts,
} from "../lib/adminItemUtils";
import type { CommentDraft } from "../components/ops/CommentsEditor";

const TOKEN_KEY = "admin:jwt";

type EditState = { id: string; originalDate: string } | null;

function isGlobalItem(i: any): boolean {
  return i?.is_global === 1 || i?.is_global === true;
}

export default function Admin() {
  const dateDefault = useMemo(() => todayYYYYMMDD(), []);
  const [date, setDate] = useState(dateDefault);

  const [showProfile, setShowProfile] = useState(false);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [availableActions, setAvailableActions] = useState<Action[]>([]);
  const [whitelist, setWhitelist] = useState<Set<string>>(new Set());

  // Form fields
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>([]);
  const [comments, setComments] = useState<CommentDraft[]>([]);
  const [isGlobal, setIsGlobal] = useState<boolean>(false);

  const [categoryTouched, setCategoryTouched] = useState(false);
  const programmaticCategoryChange = useRef(false);

  const [editing, setEditing] = useState<EditState>(null);
  const [saving, setSaving] = useState(false);

  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = `/login?next=${encodeURIComponent("/admin")}`;
  }

  function toggleComments(id: string) {
    setOpenComments((p) => ({ ...p, [id]: !p[id] }));
  }

  function resetForm() {
    setTitle("");
    setUrl("");
    setDescription("");
    setCategoryId("");
    setSelectedActionIds([]);
    setComments([]);
    setIsGlobal(false);
    setEditing(null);
    setCategoryTouched(false);
  }

  function setCategoryIdProgrammatically(nextId: string) {
    programmaticCategoryChange.current = true;
    setCategoryId(nextId);
    setTimeout(() => {
      programmaticCategoryChange.current = false;
    }, 0);
  }

  function startEdit(i: any) {
    setError(null);

    setTitle(i.title ?? "");

    const fixedUrl = autoFixUrl(i.url ?? "");
    setUrl(fixedUrl);

    setDescription(i.description ?? "");

    const existingCategory = i.category_id ?? "";
    setCategoryId(existingCategory);
    setCategoryTouched(!!existingCategory);

    setSelectedActionIds(
      Array.isArray(i.actions) ? i.actions.map((a: any) => a.id) : [],
    );
    setComments(mapItemCommentsToDrafts(i.comments));

    setIsGlobal(isGlobalItem(i));

    setEditing({ id: i.id, originalDate: i.date ?? date });

    if (!existingCategory) {
      const id = autoCategoryIdFromUrl(categories, fixedUrl);
      if (id) setCategoryIdProgrammatically(id);
    }

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
        .map((t) => t.tag.trim());
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

  async function onSubmit(fixedUrl: string) {
    setSaving(true);
    try {
      const commentsPayload = comments
        .map((c) => ({
          text: String(c.text ?? "").trim(),
          translation_text: (c.translation_text ?? "").trim()
            ? c.translation_text
            : null,
        }))
        .filter((c) => c.text.length > 0);

      const payload = {
        // date is required for POST; PUT ignores date in your API
        title: title.trim(),
        url: fixedUrl,
        description: description.trim(),
        category_id: categoryId ? categoryId : null,
        action_ids: selectedActionIds,
        comments: commentsPayload,
        is_global: isGlobal,
      };

      if (editing) {
        await adminUpdateItem(editing.id, payload);
      } else {
        await adminCreateItem({
          date,
          ...payload,
        });
      }

      resetForm();
      await load();
    } catch (e: any) {
      if (e?.status === 409 && e?.data?.code === "DUPLICATE_URL") {
        setError(
          isGlobal
            ? "این لینک قبلاً به‌عنوان آیتم همیشگی ثبت شده است."
            : "این لینک قبلاً برای همین تاریخ ثبت شده است.",
        );
      } else {
        setError(
          e?.message ??
            (editing ? "ذخیره تغییرات ناموفق بود." : "ایجاد آیتم ناموفق بود."),
        );
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
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

  return (
    <PageShell
      dir="rtl"
      header={
        <AdminHeaderBar
          date={date}
          onDateChange={setDate}
          onLogout={logout}
          onOpenProfile={() => setShowProfile((p) => !p)}
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
      {showProfile ? (
        <div className="mb-4">
          <AdminProfilePanel onClose={() => setShowProfile(false)} />
        </div>
      ) : null}

      <AdminItemForm
        itemId={editing?.id ?? null}
        date={date}
        categories={categories}
        actions={availableActions}
        whitelist={whitelist}
        title={title}
        setTitle={setTitle}
        url={url}
        setUrl={setUrl}
        description={description}
        setDescription={setDescription}
        categoryId={categoryId}
        setCategoryId={(v) => {
          setCategoryId(v);
          if (!programmaticCategoryChange.current) setCategoryTouched(true);
        }}
        selectedActionIds={selectedActionIds}
        setSelectedActionIds={setSelectedActionIds}
        comments={comments}
        setComments={setComments}
        isGlobal={isGlobal}
        setIsGlobal={setIsGlobal}
        editing={editing}
        saving={saving}
        categoryTouched={categoryTouched}
        setCategoryTouched={setCategoryTouched}
        setCategoryIdProgrammatically={setCategoryIdProgrammatically}
        error={error}
        setError={setError}
        onSubmit={onSubmit}
        onCancelEdit={resetForm}
      />

      <AdminItemList
        date={date}
        items={items}
        loading={loading}
        openComments={openComments}
        toggleComments={toggleComments}
        onDelete={onDelete}
        onStartEdit={startEdit}
      />
    </PageShell>
  );
}
