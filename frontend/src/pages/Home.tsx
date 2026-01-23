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

import CategoryGrid, { type CategoryCard } from "../components/home/CategoryGrid";
import ItemList, { type ListTab } from "../components/home/ItemList";

const STORAGE_SELECTED_DATE = "ui:selectedDate";

type View =
  | { kind: "categories" }
  | { kind: "list"; categoryId: string | null; categoryName: string };

export default function Home() {
  const today = useMemo(() => todayYYYYMMDD(), []);

  const [date, setDate] = useState<string>(() => localStorage.getItem(STORAGE_SELECTED_DATE) ?? today);

  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<StatusMap>({});
  const [tab, setTab] = useState<ListTab>("todo");
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<View>({ kind: "categories" });

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

  const total = items.length;
  const doneCount = Object.values(status).filter((s) => s === "done").length;

  const categories = useMemo<CategoryCard[]>(() => {
    const map = new Map<string, CategoryCard>();

    for (const i of items as any[]) {
      const cid = i.category_id ?? "";
      const cname = i.category_name ?? "بدون دسته‌بندی";
      const cimg = i.category_image ?? null;

      if (!cid) continue; // items without category won't appear as a category card
      if (!map.has(cid)) {
        map.set(cid, {
          id: cid,
          name: cname,
          image: cimg,
          count: 0,
        });
      }
      const cur = map.get(cid)!;
      cur.count += 1;
    }

    // Add "All"
    const all: CategoryCard = {
      id: "__all__",
      name: "نمایش همه",
      image: null,
      count: items.length,
      isAll: true,
    };

    return [all, ...Array.from(map.values()).sort((a, b) => b.count - a.count)];
  }, [items]);

  const listItems = useMemo(() => {
    if (view.kind !== "list") return [];
    if (view.categoryId === null) return items; // all
    return (items as any[]).filter((i) => i.category_id === view.categoryId);
  }, [items, view]);

  const filtered = useMemo(() => {
    if (view.kind !== "list") return [];
    return listItems.filter((i: any) => {
      const s = status[i.id];
      if (tab === "todo") return !s;
      if (tab === "later") return s === "later";
      if (tab === "done") return s === "done";
      return true;
    });
  }, [listItems, status, tab, view]);

  async function mark(id: string, s: ItemStatus) {
    await setItemStatus(date, id, s);
    const st = await getStatusMap(date);
    setStatus(st);
  }

  function goPrev() {
    setDate(addDaysYYYYMMDD(date, -1));
    setView({ kind: "categories" });
    setTab("todo");
  }

  function goNext() {
    setDate(addDaysYYYYMMDD(date, +1));
    setView({ kind: "categories" });
    setTab("todo");
  }

  function openCategory(c: CategoryCard) {
    if (c.isAll) {
      setView({ kind: "list", categoryId: null, categoryName: "نمایش همه" });
      return;
    }
    setView({ kind: "list", categoryId: c.id, categoryName: c.name });
  }

  function backToCategories() {
    setView({ kind: "categories" });
    setTab("todo");
  }

  const headerRight = (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={goPrev} title="روز قبل">
        →
      </Button>

      <DatePicker value={date} onChange={(d) => { setDate(d); setView({ kind: "categories" }); setTab("todo"); }} />

      <Button variant="secondary" onClick={goNext} title="روز بعد">
        ←
      </Button>
    </div>
  );

  return (
    <PageShell
      dir="rtl"
      header={
        <div>
          <TopBar
            dir="rtl"
            title="کارهای امروز"
            subtitle="یک دسته را انتخاب کنید و آیتم‌ها را انجام دهید."
            right={headerRight}
          />

          <div className="mt-4">
            <div className="h-2 w-full rounded bg-zinc-200">
              <div
                className="h-2 rounded bg-zinc-900"
                style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              انجام‌شده: {doneCount} از {total}
            </div>
          </div>

          {/* Small header nav for future pages */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant={view.kind === "categories" ? "secondary" : "ghost"}
              onClick={() => setView({ kind: "categories" })}
            >
              دسته‌بندی‌ها
            </Button>

            <Button
              variant="ghost"
              onClick={() => alert("صفحه بررسی هشتگ‌ها بعداً اضافه می‌شود.")}
              title="به‌زودی"
            >
              بررسی هشتگ‌ها
            </Button>

            {view.kind === "list" ? (
              <Button variant="ghost" onClick={backToCategories}>
                بازگشت
              </Button>
            ) : null}
          </div>
        </div>
      }
      footer={<></>}
    >
      {loading ? (
        <div className="text-zinc-500">در حال بارگذاری…</div>
      ) : view.kind === "categories" ? (
        categories.length <= 1 ? (
          <Card className="p-6 text-zinc-600">برای این تاریخ آیتمی وجود ندارد.</Card>
        ) : (
          <CategoryGrid categories={categories} onSelect={openCategory} />
        )
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-zinc-600">چیزی برای نمایش در این تب وجود ندارد.</Card>
      ) : (
        <ItemList
          title={view.categoryName}
          items={filtered as any[]}
          tab={tab}
          onTabChange={setTab}
          onMark={mark}
          statusMap={status}
        />
      )}
    </PageShell>
  );
}
