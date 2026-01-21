import { useEffect, useMemo, useState } from "react";
import { fetchItems } from "../lib/api";
import type { Item } from "../lib/api";

import { getStatusMap, setItemStatus } from "../lib/statusStore";
import type { ItemStatus, StatusMap } from "../lib/statusStore";

import { addDaysYYYYMMDD, todayYYYYMMDD } from "../lib/date";

type Tab = "todo" | "later" | "done";

const STORAGE_SELECTED_DATE = "ui:selectedDate";

export default function Home() {
  const today = useMemo(() => todayYYYYMMDD(), []);

  const [date, setDate] = useState<string>(() => {
    return localStorage.getItem(STORAGE_SELECTED_DATE) ?? today;
  });

  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<StatusMap>({});
  const [tab, setTab] = useState<Tab>("todo");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem(STORAGE_SELECTED_DATE, date);
  }, [date]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const [it, st] = await Promise.all([fetchItems(date), getStatusMap(date)]);
        if (!alive) return;
        setItems(it);
        setStatus(st);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [date]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const s = status[i.id];
      if (tab === "todo") return !s;
      if (tab === "later") return s === "later";
      if (tab === "done") return s === "done";
      return true;
    });
  }, [items, status, tab]);

  const total = items.length;
  const doneCount = Object.values(status).filter((s) => s === "done").length;

  async function mark(id: string, s: ItemStatus) {
    await setItemStatus(date, id, s);
    const st = await getStatusMap(date);
    setStatus(st);
  }

  function goPrev() {
    setDate(addDaysYYYYMMDD(date, -1));
  }

  function goNext() {
    setDate(addDaysYYYYMMDD(date, +1));
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Tasks</h1>
              <div className="mt-1 text-sm text-zinc-500">Pick a date and work through the list.</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={goPrev}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-100 transition"
                aria-label="Previous day"
                title="Previous day"
              >
                ←
              </button>

              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              />

              <button
                onClick={goNext}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-100 transition"
                aria-label="Next day"
                title="Next day"
              >
                →
              </button>
            </div>
          </div>

          <div className="mt-5">
            <div className="h-2 w-full rounded bg-zinc-200">
              <div
                className="h-2 rounded bg-zinc-900"
                style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              {doneCount} / {total} done
            </div>
          </div>

          <nav className="mt-6 flex gap-2">
            <TabButton active={tab === "todo"} onClick={() => setTab("todo")}>
              To do
            </TabButton>
            <TabButton active={tab === "later"} onClick={() => setTab("later")}>
              Later
            </TabButton>
            <TabButton active={tab === "done"} onClick={() => setTab("done")}>
              Done
            </TabButton>
          </nav>
        </header>

        {loading ? (
          <div className="text-zinc-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600 shadow-sm">Nothing here.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <article key={item.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <a href={item.url} target="_blank" rel="noreferrer" className="text-lg font-semibold hover:underline">
                      {item.title}
                    </a>
                    <div className="mt-1 text-sm text-zinc-600">{item.description}</div>

                    {item.action_type ? (
                      <div className="mt-2 inline-flex rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700">
                        {item.action_type}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <PrimaryButton onClick={() => mark(item.id, "done")}>Done</PrimaryButton>
                  <SecondaryButton onClick={() => mark(item.id, "later")}>Later</SecondaryButton>
                  <GhostButton onClick={() => mark(item.id, "hidden")}>Hide</GhostButton>
                </div>
              </article>
            ))}
          </div>
        )}

        <footer className="mt-10 text-xs text-zinc-500">
          Admin:{" "}
          <a className="underline" href="/admin">
            /admin
          </a>
        </footer>
      </div>
    </div>
  );
}

function TabButton(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      className={[
        "rounded-full px-4 py-2 text-sm transition border",
        props.active ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100",
      ].join(" ")}
    >
      {props.children}
    </button>
  );
}

function PrimaryButton(props: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 transition"
    >
      {props.children}
    </button>
  );
}

function SecondaryButton(props: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-100 transition"
    >
      {props.children}
    </button>
  );
}

function GhostButton(props: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={props.onClick} className="rounded-xl px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 transition">
      {props.children}
    </button>
  );
}
