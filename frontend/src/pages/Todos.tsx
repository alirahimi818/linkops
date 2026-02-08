import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  fetchItems,
  fetchItemsFeed,
  fetchItemsSummary,
  setItemStatusRemote,
} from "../lib/api";
import type {
  Item,
  ItemSettableStatus,
  ItemsSummaryResponse,
  ItemUserStatus,
  FeedTab,
  ItemsFeedResponse,
} from "../lib/api";

import { addDaysYYYYMMDD, todayYYYYMMDD } from "../lib/date";

import PageShell from "../components/layout/PageShell";
import TopBar from "../components/layout/TopBar";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import DismissibleAnnouncementModal from "../components/ui/DismissibleAnnouncementModal";

import CategoryGrid, {
  type CategoryCard,
} from "../components/home/CategoryGrid";
import ItemList, { type ListTab } from "../components/home/ItemList";
import {
  migrateLegacyStatusToServer,
  shouldRunLegacyMigration,
} from "../lib/statusMigration";
import DateRangePicker from "../components/ui/DateRangePicker";

type View =
  | { kind: "categories" }
  | { kind: "list"; categoryId: string | null; categoryName: string };

function safeTab(v: string | null): ListTab {
  if (v === "todo" || v === "later" || v === "done" || v === "hidden") return v;
  return "todo";
}

function statusOf(i: any): ItemUserStatus {
  const s = String(i?.user_status ?? "todo");
  if (s === "later" || s === "done" || s === "hidden") return s;
  return "todo";
}

function sumCounts(c: {
  todo: number;
  later: number;
  done: number;
  hidden: number;
}) {
  return (c?.todo ?? 0) + (c?.later ?? 0) + (c?.done ?? 0) + (c?.hidden ?? 0);
}

export default function Todos() {
  const today = useMemo(() => todayYYYYMMDD(), []);
  const [sp, setSp] = useSearchParams();

  const itemId = sp.get("item") ?? undefined;
  const isItemView = !!itemId;

  const DEFAULT_DAYS = 7;
  const to = sp.get("to") ?? today;
  const from = sp.get("from") ?? addDaysYYYYMMDD(to, -(DEFAULT_DAYS - 1));

  const range = useMemo(() => ({ from, to }), [from, to]);

  const tab = safeTab(sp.get("tab"));
  const cat = sp.get("cat");

  const view: View = useMemo(() => {
    if (itemId) {
      return { kind: "list", categoryId: null, categoryName: "نمایش آیتم" };
    }
    if (!cat) return { kind: "categories" };
    if (cat === "all")
      return { kind: "list", categoryId: null, categoryName: "نمایش همه" };
    return {
      kind: "list",
      categoryId: cat,
      categoryName: sp.get("catName") ?? "دسته",
    };
  }, [cat, sp, itemId]);

  const [loading, setLoading] = useState(true);

  // Summary (for categories view)
  const [summary, setSummary] = useState<ItemsSummaryResponse | null>(null);

  // Item view (single)
  const [singleItems, setSingleItems] = useState<Item[]>([]);

  // Feed list (infinite)
  const [feedItems, setFeedItems] = useState<Item[]>([]);
  const [feedCounts, setFeedCounts] = useState({
    todo: 0,
    later: 0,
    done: 0,
    hidden: 0,
  });
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Keep date valid format
  useEffect(() => {
    const ok = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

    if (!ok(from) || !ok(to)) {
      const fallbackTo = today;
      const fallbackFrom = addDaysYYYYMMDD(fallbackTo, -(DEFAULT_DAYS - 1));

      setSp((p) => {
        p.set("from", fallbackFrom);
        p.set("to", fallbackTo);
        p.delete("cat");
        p.delete("catName");
        p.set("tab", "todo");
        return p;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One-time legacy migration
  useEffect(() => {
    if (!shouldRunLegacyMigration()) return;
    migrateLegacyStatusToServer().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeCat = useMemo(() => {
    if (isItemView) return "all";
    if (!cat) return "all";
    if (cat === "all") return "all";
    return cat; // category_id or "__other__"
  }, [cat, isItemView]);

  // Load summary always (fast)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sum = await fetchItemsSummary(range.from, range.to);
        if (!alive) return;
        setSummary(sum);
      } catch {
        if (!alive) return;
        setSummary(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [range.from, range.to]);

  // Main data loader (either item view or feed list)
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        // reset paging state on any main reload
        setCursor(null);
        setHasMore(false);
        setLoadingMore(false);

        if (isItemView) {
          const it = await fetchItems(range.to, itemId);
          if (!alive) return;

          setSingleItems(it ?? []);
          setFeedItems([]);
          setCursor(null);
          setHasMore(false);
          setFeedCounts({ todo: 0, later: 0, done: 0, hidden: 0 });
          return;
        }

        if (view.kind !== "list") {
          // categories page
          setSingleItems([]);
          setFeedItems([]);
          setFeedCounts({ todo: 0, later: 0, done: 0, hidden: 0 });
          return;
        }

        // Feed first page for selected cat+tab+range
        const res: ItemsFeedResponse = await fetchItemsFeed({
          from: range.from,
          to: range.to,
          tab: tab as FeedTab,
          cat: activeCat,
          limit: 20,
          cursor: null,
        });

        if (!alive) return;

        setFeedItems(res.items ?? []);
        setFeedCounts(res.counts ?? { todo: 0, later: 0, done: 0, hidden: 0 });
        setCursor(res.next_cursor ?? null);
        setHasMore(!!res.next_cursor);

        setSingleItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isItemView, itemId, view.kind, tab, activeCat, range.from, range.to]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    if (isItemView) return;
    if (view.kind !== "list") return;

    setLoadingMore(true);
    try {
      const res: ItemsFeedResponse = await fetchItemsFeed({
        from: range.from,
        to: range.to,
        tab: tab as FeedTab,
        cat: activeCat,
        limit: 20,
        cursor,
      });

      setFeedItems((prev) => [...prev, ...(res.items ?? [])]);
      setFeedCounts(res.counts ?? feedCounts);
      setCursor(res.next_cursor ?? null);
      setHasMore(!!res.next_cursor);
    } finally {
      setLoadingMore(false);
    }
  }

  const categories = useMemo<CategoryCard[]>(() => {
    if (itemId) return [];
    const list = summary?.categories ?? [];
    return list.map((c) => ({
      id: c.id === "all" ? "__all__" : c.id,
      name: c.name,
      image: c.image,
      count: c.count,
      isAll: c.id === "all" || c.isAll === true,
    }));
  }, [summary, itemId]);

  async function mark(id: string, s: ItemSettableStatus | null) {
    const nextStatus: ItemUserStatus = s ?? "todo";

    if (isItemView) {
      setSingleItems((prev) =>
        prev.map((it: any) =>
          String(it.id) === String(id)
            ? { ...it, user_status: nextStatus }
            : it,
        ),
      );
    } else {
      // update items
      setFeedItems((prev) =>
        prev.map((it: any) =>
          String(it.id) === String(id)
            ? { ...it, user_status: nextStatus }
            : it,
        ),
      );

      // adjust counts using prev snapshot (avoid stale closure on feedItems)
      setFeedCounts((prevCounts) => {
        // find old status from current list snapshot (best effort)
        const oldItem = feedItems.find(
          (x: any) => String(x.id) === String(id),
        ) as any;
        const oldStatus: ItemUserStatus = oldItem
          ? statusOf(oldItem)
          : (tab as any);

        const out: any = { ...prevCounts };
        out[oldStatus] = Math.max(0, (out[oldStatus] ?? 0) - 1);
        out[nextStatus] = (out[nextStatus] ?? 0) + 1;
        return out;
      });

      // remove from current tab list if not matching
      const currentTab = tab as ItemUserStatus;
      if (currentTab !== nextStatus) {
        setFeedItems((prev) =>
          prev.filter((it: any) => String(it.id) !== String(id)),
        );
      }
    }

    try {
      await setItemStatusRemote(id, s);
    } catch (e) {
      // rollback via refetch current view
      if (isItemView) {
        const it = await fetchItems(range.to, itemId);
        setSingleItems(it ?? []);
      } else if (view.kind === "list") {
        const res: ItemsFeedResponse = await fetchItemsFeed({
          from: range.from,
          to: range.to,
          tab: tab as FeedTab,
          cat: activeCat,
          limit: 20,
          cursor: null,
        });
        setFeedItems(res.items ?? []);
        setFeedCounts(res.counts ?? { todo: 0, later: 0, done: 0, hidden: 0 });
        setCursor(res.next_cursor ?? null);
        setHasMore(!!res.next_cursor);
      }
      throw e;
    }
  }

  function setRange(next: { from: string; to: string }) {
    setSp((p) => {
      p.set("from", next.from);
      p.set("to", next.to);

      p.delete("cat");
      p.delete("catName");
      p.delete("item");
      p.set("tab", "todo");
      return p;
    });
  }

  function diffDaysInclusive(from: string, to: string) {
    const a = new Date(from + "T00:00:00Z").getTime();
    const b = new Date(to + "T00:00:00Z").getTime();
    const ms = 24 * 60 * 60 * 1000;
    const diff = Math.floor((b - a) / ms);
    return Math.max(1, diff + 1); // inclusive
  }

  function shiftRange(r: { from: string; to: string }, deltaDays: number) {
    return {
      from: addDaysYYYYMMDD(r.from, deltaDays),
      to: addDaysYYYYMMDD(r.to, deltaDays),
    };
  }

  function setTab(next: ListTab) {
    setSp((p) => {
      p.set("tab", next);
      return p;
    });
  }

  function goPrevRange() {
    const len = diffDaysInclusive(range.from, range.to);
    setRange(shiftRange(range, -len));
  }

  function goNextRange() {
    const len = diffDaysInclusive(range.from, range.to);
    setRange(shiftRange(range, +len));
  }

  function openCategory(c: CategoryCard) {
    setSp((p) => {
      p.set("tab", "todo");

      if (c.isAll) {
        p.set("cat", "all");
        p.set("catName", "نمایش همه");
        return p;
      }

      p.set("cat", c.id);
      p.set("catName", c.name);
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
    <div>
      {itemId ? (
        <Button
          variant="secondary"
          onClick={() => {
            setSp((p) => {
              p.delete("item");
              return p;
            });
          }}
        >
          بازگشت به لیست
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            className="px-2!"
            variant="secondary"
            onClick={goNextRange}
            title="جلو به اندازه بازه"
          >
            +بازه
          </Button>

          <DateRangePicker
            value={range}
            onChange={setRange}
            titleFrom="از تاریخ"
            titleTo="تا تاریخ"
          />

          <Button
            className="px-2!"
            variant="secondary"
            onClick={goPrevRange}
            title="عقب به اندازه بازه"
          >
            -بازه
          </Button>
        </div>
      )}
    </div>
  );

  const progressCounts = useMemo(() => {
    if (isItemView) {
      const it = singleItems?.[0] as any;
      const done = it && statusOf(it) === "done" ? 1 : 0;
      return { total: singleItems.length, done };
    }

    if (view.kind === "categories") {
      const t = summary?.tabs ?? { todo: 0, later: 0, done: 0, hidden: 0 };
      return { total: sumCounts(t), done: t.done ?? 0 };
    }

    return { total: sumCounts(feedCounts), done: feedCounts.done ?? 0 };
  }, [isItemView, singleItems, view.kind, summary, feedCounts]);

  const listData = isItemView ? singleItems : feedItems;
  const listCounts = isItemView
    ? { todo: singleItems.length, later: 0, done: 0, hidden: 0 }
    : feedCounts;

  return (
    <PageShell
      dir="rtl"
      header={
        <div>
          <TopBar
            dir="rtl"
            title={itemId ? "مشاهده فعالیت" : "فعالیت‌ها"}
            subtitle={
              itemId
                ? "شما در حال مشاهده یک فعالیت خاص هستید."
                : `فیلتر بازه: ${range.from} تا ${range.to}`
            }
            right={headerRight}
          />

          <div className="mt-4">
            <div className="h-2 w-full rounded bg-zinc-200">
              <div
                className="h-2 rounded bg-zinc-900"
                style={{
                  width: `${
                    progressCounts.total
                      ? (progressCounts.done / progressCounts.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              انجام‌شده: {progressCounts.done} از {progressCounts.total}
            </div>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="text-zinc-500">در حال بارگذاری…</div>
      ) : view.kind === "categories" ? (
        categories.length <= 1 ? (
          <Card className="p-6 text-zinc-600">
            برای این بازه آیتمی وجود ندارد.
          </Card>
        ) : (
          <CategoryGrid categories={categories} onSelect={openCategory} />
        )
      ) : (
        <ItemList
          title={view.categoryName}
          itemId={itemId ?? null}
          items={listData as any[]}
          counts={listCounts}
          tab={tab}
          onTabChange={setTab}
          onMark={mark}
          onBack={backToCategories}
          hasMore={!isItemView && view.kind === "list" ? hasMore : false}
          loadingMore={
            !isItemView && view.kind === "list" ? loadingMore : false
          }
          onLoadMore={
            !isItemView && view.kind === "list" ? loadMore : undefined
          }
        />
      )}

      <DismissibleAnnouncementModal
        scopeKey="/"
        id="todos-2026-01"
        title="راهنمای سریع"
        description="توی این بخش می‌تونی وارد یکی از دسته‌ها (اینستاگرام، X (توییتر) و ...) بشی و لیست لینک‌های مهم روز رو ببینی. کنار هر لینک، کامنت‌ها و ری‌اکشن‌های پیشنهادی آماده‌ست که می‌تونی مستقیم کپی کنی و استفاده کنی و دکمه انجام شدش رو بزنی، خیلی ساده و سریع! سعی میکنم به زودی به این بخش هوش مصنوعی هم اضافه کنم که کار خیلی راحت تر بشه."
        imageUrl="/assets/todos-background.jpg"
      />
    </PageShell>
  );
}
