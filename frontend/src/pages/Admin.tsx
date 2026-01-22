import { useEffect, useMemo, useState } from "react";
import { adminCreateItem, adminDeleteItem, adminFetchItems } from "../lib/api";
import type { Item } from "../lib/api";
import { todayYYYYMMDD } from "../lib/date";

import PageShell from "../components/layout/PageShell";
import TopBar from "../components/layout/TopBar";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import Badge from "../components/ui/Badge";

const TOKEN_KEY = "admin:jwt";

export default function Admin() {
  const dateDefault = useMemo(() => todayYYYYMMDD(), []);
  const [date, setDate] = useState(dateDefault);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [actionType, setActionType] = useState("");

  async function load() {
    setLoading(true);
    try {
      const it = await adminFetchItems(date);
      setItems(it);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = `/login?next=${encodeURIComponent("/admin")}`;
  }

  async function onCreate() {
    if (!title.trim() || !url.trim() || !description.trim()) return;

    await adminCreateItem({
      date,
      title: title.trim(),
      url: url.trim(),
      description: description.trim(),
      action_type: actionType.trim() ? actionType.trim() : null,
    });

    setTitle("");
    setUrl("");
    setDescription("");
    setActionType("");
    await load();
  }

  async function onDelete(id: string) {
    await adminDeleteItem(id);
    await load();
  }

  return (
    <PageShell
      header={
        <TopBar
          title="Admin"
          subtitle="Add and manage daily items."
          right={
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-600">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              />
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
      <Card>
        <div className="grid gap-3">
          <Input value={title} onChange={setTitle} placeholder="Title" />
          <Input value={url} onChange={setUrl} placeholder="URL" />
          <Input value={actionType} onChange={setActionType} placeholder="Action type (optional)" />
          <Textarea value={description} onChange={setDescription} placeholder="Short description" />

          <Button onClick={onCreate} disabled={!title.trim() || !url.trim() || !description.trim()}>
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
                      {i.action_type ? <Badge>{i.action_type}</Badge> : null}
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
