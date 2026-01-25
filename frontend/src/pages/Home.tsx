import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

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

type View =
  | { kind: "categories" }
  | { kind: "list"; categoryId: string | null; categoryName: string };

function safeTab(v: string | null): ListTab {
  if (v === "todo" || v === "later" || v === "done" || v === "hidden") return v;
  return "todo";
}

export default function Home() {
  const today = useMemo(() => todayYYYYMMDD(), []);
  const [sp, setSp] = useSearchParams();

  // URL state (source of truth)
  const date = sp.get("date") ?? today;
  const tab = safeTab(sp.get("tab"));
  const cat = sp.get("cat"); // category id or "all"
  const view: View = useMemo(() => {
    if (!cat) return { kind: "categories" };
    if (cat === "all") return { kind: "list", categoryId: null, categoryName: "نمایش همه" };
    return { kind: "list", categoryId: cat, categoryName: sp.get("catName") ?? "دسته" };
  }, [cat, sp]);

  // Data
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<StatusMap>({});
  const [loading, setLoading] = useState(true);

  // Keep date valid format (optional strictness)
  useEffect(() => {
    // if date is invalid, reset to today
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setSp((p) => {
        p.set("date", today);
        p.delete("cat");
        p.delete("catName");
        p.set("tab", "todo");
        return p;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const categories = useMemo<CategoryCard[]>(() => {
    const map = new Map<string, CategoryCard>();

    for (const i of items as any[]) {
      const cid = i.category_id ?? "";
      const cname = i.category_name ?? "بدون دسته‌بندی";
      const cimg = i.category_image ?? null;

      if (!cid) continue;
      if (!map.has(cid)) {
        map.set(cid, { id: cid, name: cname, image: cimg, count: 0 });
      }
      map.get(cid)!.count += 1;
    }

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
    if (view.categoryId === null) return items;
    return (items as any[]).filter((i) => i.category_id === view.categoryId);
  }, [items, view]);

  const filtered = useMemo(() => {
    if (view.kind !== "list") return [];
    return listItems.filter((i: any) => {
      const s = status[i.id];
      if (tab === "todo") return !s; // undefined only
      if (tab === "later") return s === "later";
      if (tab === "done") return s === "done";
      if (tab === "hidden") return s === "hidden";
      return true;
    });
  }, [listItems, status, tab, view]);

  const total = items.length;
  const doneCount = Object.values(status).filter((s) => s === "done").length;

  async function mark(id: string, s: ItemStatus | null) {
    await setItemStatus(date, id, s);
    const st = await getStatusMap(date);
    setStatus(st);
  }


  function setDate(next: string) {
    setSp((p) => {
      p.set("date", next);
      p.delete("cat");
      p.delete("catName");
      p.set("tab", "todo");
      return p;
    });
  }

  function setTab(next: ListTab) {
    setSp((p) => {
      p.set("tab", next);
      return p;
    });
  }

  function goPrev() {
    setDate(addDaysYYYYMMDD(date, -1));
  }

  function goNext() {
    setDate(addDaysYYYYMMDD(date, +1));
  }

  function openCategory(c: CategoryCard) {
    setSp((p) => {
      p.set("tab", "todo");
      if (c.isAll) {
        p.set("cat", "all");
        p.set("catName", "نمایش همه");
      } else {
        p.set("cat", c.id);
        p.set("catName", c.name);
      }
      return p;
    });
  }

  function backToCategories() {
    setSp((p) => {
      p.delete("cat");
      p.delete("catName");
      p.set("tab", "todo");
      return p;
    });
  }

  const headerRight = (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={goNext} title="روز بعد">
        →
      </Button>

      <DatePicker value={date} onChange={setDate} />

      <Button variant="secondary" onClick={goPrev} title="روز قبل">
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
        </div>
      }
    >
      {loading ? (
        <div className="text-zinc-500">در حال بارگذاری…</div>
      ) : view.kind === "categories" ? (
        categories.length <= 1 ? (
          <Card className="p-6 text-zinc-600">برای این تاریخ آیتمی وجود ندارد.</Card>
        ) : (
          <CategoryGrid categories={categories} onSelect={openCategory} />
        )
      ) : (
        <ItemList
          title={view.categoryName}
          items={filtered as any[]}
          tab={tab}
          onTabChange={setTab}
          onMark={mark}
          statusMap={status}
          onBack={backToCategories}
        />
      )}
    </PageShell>
  );
}
