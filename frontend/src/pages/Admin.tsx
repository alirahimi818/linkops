import { useEffect, useMemo, useState } from "react";
import { adminCreateItem, adminDeleteItem, adminFetchCategories, adminFetchItems, fetchHashtagWhitelist } from "../lib/api";
import type { Category, HashtagWhitelistRow, Item } from "../lib/api";
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

import TokenInput from "../components/ops/TokenInput";
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

  const [whitelist, setWhitelist] = useState<Set<string>>(new Set());

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");

  const [actions, setActions] = useState<string[]>([]);
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
      setError(e?.message ?? "Failed to load items.");
    } finally {
      setLoading(false);
    }
  }

  async function bootstrap() {
    try {
      const [cats, tags] = await Promise.all([adminFetchCategories(), fetchHashtagWhitelist()]);
      console.log("cats from adminFetchCategories:", cats); // <-- add this
      setCategories(cats);

      const active = (tags as HashtagWhitelistRow[])
        .filter((t) => t.is_active === 1)
        .map((t) => t.tag.toLowerCase());
      setWhitelist(new Set(active));
    } catch (e: any) {
          console.error("categories bootstrap failed:", e);
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

    // block create if hashtag issues exist (only if whitelist loaded)
    if (whitelist.size > 0) {
      const issues = validateHashtags(comments.join("\n"), whitelist);
      if (issues.length > 0) {
        setError("Please fix hashtag issues in comments before creating the item.");
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
        actions,
        comments,
      });

      setTitle("");
      setUrl("");
      setDescription("");
      setCategoryId("");
      setActions([]);
      setComments([]);

      await load();
    } catch (e: any) {
      setError(e?.message ?? "Create failed.");
    }
  }

  async function onDelete(id: string) {
    setError(null);
    try {
      await adminDeleteItem(id);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Delete failed.");
    }
  }

  const createDisabled = !title.trim() || !url.trim() || !description.trim();

  return (
    <PageShell
      header={
        <TopBar
          title="Admin"
          subtitle="Add and manage daily items."
          right={
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-600">Date</span>
              <DatePicker value={date} onChange={setDate} />
              <Button variant="secondary" onClick={logout}>
                Logout
              </Button>
            </div>
          }
        />
      }
      footer={
        <>
          Back to{" "}
          <a className="underline" href="/">
            home
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
          <Input value={title} onChange={setTitle} placeholder="Title" />
          <Input value={url} onChange={setUrl} placeholder="URL" />

          <Select value={categoryId} onChange={setCategoryId}>
            <option value="">Category (optional)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          <Textarea value={description} onChange={setDescription} placeholder="Short description" />

          <TokenInput
            label="Actions"
            placeholder='Type actions and press Enter or "," (e.g. like, comment, rate)'
            value={actions}
            onChange={setActions}
            maxItems={10}
            maxLen={60}
          />

          <CommentsEditor
            label="Example comments (max 20)"
            value={comments}
            onChange={setComments}
            whitelist={whitelist}
            maxItems={20}
            maxLen={400}
          />

          <Button onClick={onCreate} disabled={createDisabled}>
            Add item
          </Button>

          <div className="text-xs text-zinc-500">Tip: Keep descriptions short so users can move fast.</div>
        </div>
      </Card>

      <section className="mt-6">
        <div className="mb-3 text-sm text-zinc-500">Items for {date}</div>

        {loading ? (
          <div className="text-zinc-500">Loading…</div>
        ) : items.length === 0 ? (
          <Card className="p-6 text-zinc-600">No items yet.</Card>
        ) : (
          <div className="space-y-3">
            {items.map((i: any) => (
              <Card key={i.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold">{i.title}</div>

                    <a className="mt-1 block truncate text-sm text-zinc-600 underline" href={i.url} target="_blank" rel="noreferrer">
                      {i.url}
                    </a>

                    <div className="mt-2 text-sm text-zinc-700">{i.description}</div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {i.category_name ? <Badge>{i.category_name}</Badge> : null}
                      {Array.isArray(i.actions) ? i.actions.map((a: string) => <Badge key={a}>{a}</Badge>) : null}

                      <span className="text-xs text-zinc-500">
                        by {i.created_by_username ?? "unknown"} • {new Date(i.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <Button variant="secondary" onClick={() => onDelete(i.id)}>
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
