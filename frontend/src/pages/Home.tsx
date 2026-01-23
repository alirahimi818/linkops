import { useEffect, useMemo, useState } from "react";
import { fetchItems } from "../lib/api";
import type { Item } from "../lib/api";

import { getStatusMap, setItemStatus } from "../lib/statusStore";
import type { ItemStatus, StatusMap } from "../lib/statusStore";

import { addDaysYYYYMMDD, todayYYYYMMDD } from "../lib/date";

import PageShell from "../components/layout/PageShell";
import TopBar from "../components/layout/TopBar";

import DatePicker from "../components/ui/DatePicker";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Tabs, { TabButton } from "../components/ui/Tabs";

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
    <PageShell
      header={
        <div>
          <TopBar
            title="Tasks"
            subtitle="Pick a date and work through the list."
            right={
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={goPrev} title="Previous day">
                  ←
                </Button>

                <DatePicker value={date} onChange={setDate} />

                <Button variant="secondary" onClick={goNext} title="Next day">
                  →
                </Button>
              </div>
            }
          />

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

          <Tabs>
            <TabButton active={tab === "todo"} onClick={() => setTab("todo")}>
              To do
            </TabButton>
            <TabButton active={tab === "later"} onClick={() => setTab("later")}>
              Later
            </TabButton>
            <TabButton active={tab === "done"} onClick={() => setTab("done")}>
              Done
            </TabButton>
          </Tabs>
        </div>
      }
      footer={<></>}
    >
      {loading ? (
        <div className="text-zinc-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-zinc-600">Nothing here.</Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <Card key={item.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-lg font-semibold hover:underline"
                  >
                    {item.title}
                  </a>

                  <div className="mt-1 text-sm text-zinc-600">{item.description}</div>

                  {Array.isArray(item.actions) && item.actions.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.actions.map((a: any) => (
                        <Badge key={a.id}>{a.label ?? a.name}</Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => mark(item.id, "done")}>Done</Button>
                <Button variant="secondary" onClick={() => mark(item.id, "later")}>
                  Later
                </Button>
                <Button variant="ghost" onClick={() => mark(item.id, "hidden")}>
                  Hide
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}