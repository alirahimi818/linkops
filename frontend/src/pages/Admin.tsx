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
  mapItemCommentsToStrings,
} from "../lib/adminItemUtils";

const TOKEN_KEY = "admin:jwt";

type EditState = { id: string; originalDate: string } | null;

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
  const [comments, setComments] = useState<string[]>([]);

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
    setComments(mapItemCommentsToStrings(i.comments));

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

  async function onSubmit(fixedUrl: string) {
    setSaving(true);
    try {
      if (editing) {
        await adminUpdateItem(editing.id, {
          title: title.trim(),
          url: fixedUrl,
          description: description.trim(),
          category_id: categoryId ? categoryId : null,
          action_ids: selectedActionIds,
          comments,
        });
      } else {
        await adminCreateItem({
          date,
          title: title.trim(),
          url: fixedUrl,
          description: description.trim(),
          category_id: categoryId ? categoryId : null,
          action_ids: selectedActionIds,
          comments,
        });
      }

      resetForm();
      await load();
    } catch (e: any) {
      setError(
        e?.message ??
          (editing ? "ذخیره تغییرات ناموفق بود." : "ایجاد آیتم ناموفق بود."),
      );
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
