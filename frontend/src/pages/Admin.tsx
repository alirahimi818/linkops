import { useEffect, useMemo, useState } from "react";
import { adminCreateItem, adminDeleteItem, adminFetchItems } from "../lib/api";
import type { Item } from "../lib/api";

import { todayYYYYMMDD } from "../lib/date";

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
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Admin</h1>
              <div className="mt-1 text-sm text-zinc-500">Add and manage daily items.</div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-600">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3">
            <Input value={title} onChange={setTitle} placeholder="Title" />
            <Input value={url} onChange={setUrl} placeholder="URL" />
            <Input value={actionType} onChange={setActionType} placeholder="Action type (optional)" />
            <Textarea value={description} onChange={setDescription} placeholder="Short description" />

            <button
              onClick={onCreate}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 transition"
            >
              Add item
            </button>

            <div className="text-xs text-zinc-500">
              Tip: Keep descriptions short so users can move fast.
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 text-sm text-zinc-500">Items for {date}</div>

          {loading ? (
            <div className="text-zinc-500">Loading…</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600 shadow-sm">
              No items yet.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((i) => (
                <div key={i.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
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
                        {i.action_type ? (
                          <span className="inline-flex rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700">
                            {i.action_type}
                          </span>
                        ) : null}

                        <span className="text-xs text-zinc-500">
                          by {i.created_by_email ?? "unknown"} • {new Date(i.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => onDelete(i.id)}
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-10 text-xs text-zinc-500">
          Back to{" "}
          <a className="underline" href="/">
            home
          </a>
        </footer>
      </div>
    </div>
  );
}

function Input(props: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
    />
  );
}

function Textarea(props: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <textarea
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      className="min-h-[110px] rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
    />
  );
}