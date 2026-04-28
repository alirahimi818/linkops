import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  fetchItems,
  fetchItemsFeed,
  fetchItemsSummary,
  fetchActions,
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
import DismissibleAnnouncementModal from "../components/ui/DismissibleAnnouncementModal";

import CategoryGrid, { type CategoryCard } from "../components/home/CategoryGrid";
import ItemList, { type ListTab } from "../components/home/ItemList";
import SearchFilter, { type FilterOption } from "../components/home/SearchFilter";
import { migrateLegacyStatusToServer, shouldRunLegacyMigration } from "../lib/statusMigration";
import SuggestLinkButton from "../components/home/SuggestLinkButton";

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

function sumCounts(c: { todo: number; later: number; done: number; hidden: number }) {
  return (c?.todo ?? 0) + (c?.later ?? 0) + (c?.done ?? 0) + (c?.hidden ?? 0);
}

// Fixed look-back window — no date picker shown to users
const LOOKBACK_DAYS = 30;

export default function Todos() {
  const today = useMemo(() => todayYYYYMMDD(), []);
  const from = useMemo(() => addDaysYYYYMMDD(today, -(LOOKBACK_DAYS - 1)), [today]);
  const to = today;

  const [sp, setSp] = useSearchParams();

  const itemId = sp.get("item") ?? undefined;
  const isItemView = !!itemId;

  const tab = safeTab(sp.get("tab"));
  const cat = sp.get("cat");
  const searchQ = sp.get("q") ?? "";
  const actionId = sp.get("action") ?? "";

  const view: View = useMemo(() => {
    if (itemId) return { kind: "list", categoryId: null, categoryName: "نمایش آیتم" };
    if (!cat) return { kind: "categories" };
    if (cat === "all") return { kind: "list", categoryId: null, categoryName: "نمایش همه" };
    return { kind: "list", categoryId: cat, categoryName: sp.get("catName") ?? "دسته" };
  }, [cat, sp, itemId]);

  const activeCat = useMemo(() => {
    if (isItemView) return "all";
    if (!cat || cat === "all") return "all";
    return cat;
  }, [cat, isItemView]);

  const [loading, setLoading] = useState(true);
  const [allActions, setAllActions] = useState<FilterOption[]>([]);
  const [summary, setSummary] = useState<ItemsSummaryResponse | null>(null);
  const [singleItems, setSingleItems] = useState<Item[]>([]);
  const [feedItems, setFeedItems] = useState<Item[]>([]);
  const [feedCounts, setFeedCounts] = useState({ todo: 0, later: 0, done: 0, hidden: 0 });
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    fetchActions()
      .then((list) =>
        setAllActions((list as any[]).map((a) => ({ id: String(a.id), name: a.label ?? a.name }))),
      )
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!shouldRunLegacyMigration()) return;
    migrateLegacyStatusToServer().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load category summary
  useEffect(() => {
    let alive = true;
    fetchItemsSummary(from, to)
      .then((s) => { if (alive) setSummary(s); })
      .catch(() => { if (alive) setSummary(null); });
    return () => { alive = false; };
  }, [from, to]);

  // Main feed loader — resets on any filter/tab/category change
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setCursor(null);
        setHasMore(false);
        setLoadingMore(false);

        if (isItemView) {
          const it = await fetchItems(to, itemId);
          if (!alive) return;
          setSingleItems(it ?? []);
          setFeedItems([]);
          setFeedCounts({ todo: 0, later: 0, done: 0, hidden: 0 });
          return;
        }

        if (view.kind !== "list") {
          setSingleItems([]);
          setFeedItems([]);
          setFeedCounts({ todo: 0, later: 0, done: 0, hidden: 0 });
          return;
        }

        const res: ItemsFeedResponse = await fetchItemsFeed({
          from,
          to,
          tab: tab as FeedTab,
          cat: activeCat,
          search: searchQ,
          action: actionId,
          limit: 15,
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

    return () => { alive = false; };
  }, [isItemView, itemId, view.kind, tab, activeCat, from, to, searchQ, actionId]);

  async function loadMore() {
    if (loadingMore || !hasMore || isItemView || view.kind !== "list") return;
    setLoadingMore(true);
    try {
      const res: ItemsFeedResponse = await fetchItemsFeed({
        from,
        to,
        tab: tab as FeedTab,
        cat: activeCat,
        search: searchQ,
        action: actionId,
        limit: 15,
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
    return (summary?.categories ?? []).map((c) => ({
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
        prev.map((it: any) => String(it.id) === String(id) ? { ...it, user_status: nextStatus } : it),
      );
    } else {
      setFeedItems((prev) =>
        prev.map((it: any) => String(it.id) === String(id) ? { ...it, user_status: nextStatus } : it),
      );
      setFeedCounts((prevCounts) => {
        const oldItem = feedItems.find((x: any) => String(x.id) === String(id)) as any;
        const oldStatus: ItemUserStatus = oldItem ? statusOf(oldItem) : (tab as any);
        const out: any = { ...prevCounts };
        out[oldStatus] = Math.max(0, (out[oldStatus] ?? 0) - 1);
        out[nextStatus] = (out[nextStatus] ?? 0) + 1;
        return out;
      });
      if ((tab as ItemUserStatus) !== nextStatus) {
        setFeedItems((prev) => prev.filter((it: any) => String(it.id) !== String(id)));
      }
    }

    try {
      await setItemStatusRemote(id, s);
    } catch {
      // rollback
      if (isItemView) {
        const it = await fetchItems(to, itemId);
        setSingleItems(it ?? []);
      } else if (view.kind === "list") {
        const res = await fetchItemsFeed({ from, to, tab: tab as FeedTab, cat: activeCat, search: searchQ, action: actionId, limit: 15, cursor: null });
        setFeedItems(res.items ?? []);
        setFeedCounts(res.counts ?? { todo: 0, later: 0, done: 0, hidden: 0 });
        setCursor(res.next_cursor ?? null);
        setHasMore(!!res.next_cursor);
      }
    }
  }

  function setTab(next: ListTab) {
    setSp((p) => { p.set("tab", next); return p; });
  }

  function openCategory(c: CategoryCard) {
    setSp((p) => {
      p.set("tab", "todo");
      p.delete("q");
      p.delete("action");
      if (c.isAll) { p.set("cat", "all"); p.set("catName", "نمایش همه"); }
      else { p.set("cat", c.id); p.set("catName", c.name); }
      return p;
    });
  }

  function backToCategories() {
    setSp((p) => {
      p.delete("cat"); p.delete("catName");
      p.delete("q"); p.delete("action");
      p.set("tab", "todo");
      return p;
    });
  }

  function setSearch(q: string) {
    setSp((p) => { if (q) p.set("q", q); else p.delete("q"); return p; });
  }

  function setActionFilter(id: string) {
    setSp((p) => { if (id) p.set("action", id); else p.delete("action"); return p; });
  }

  const progressCounts = useMemo(() => {
    if (isItemView) {
      const it = singleItems?.[0] as any;
      return { total: singleItems.length, done: it && statusOf(it) === "done" ? 1 : 0 };
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
                : "یک دسته رو انتخاب کن و فعالیت‌هاش رو انجام بده."
            }
            left={
              itemId ? (
                <button
                  type="button"
                  onClick={() => setSp((p) => { p.delete("item"); return p; })}
                  className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  ← بازگشت به لیست
                </button>
              ) : (
                <SuggestLinkButton />
              )
            }
          />

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-zinc-500">
                {progressCounts.done} از {progressCounts.total} انجام شده
              </span>
              {progressCounts.total > 0 ? (
                <span className="text-xs text-zinc-400">
                  {Math.round((progressCounts.done / progressCounts.total) * 100)}٪
                </span>
              ) : null}
            </div>
            <div className="h-1.5 w-full rounded-full bg-zinc-200">
              <div
                className="h-1.5 rounded-full bg-zinc-800 transition-all duration-500"
                style={{
                  width: progressCounts.total
                    ? `${(progressCounts.done / progressCounts.total) * 100}%`
                    : "0%",
                }}
              />
            </div>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12 text-zinc-400">
          <svg className="h-5 w-5 animate-spin ml-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          در حال بارگذاری…
        </div>
      ) : view.kind === "categories" ? (
        categories.length <= 1 ? (
          <Card className="p-6 text-zinc-600">برای این بازه آیتمی وجود ندارد.</Card>
        ) : (
          <CategoryGrid categories={categories} onSelect={openCategory} />
        )
      ) : (
        <>
          {!isItemView ? (
            <SearchFilter
              searchText={searchQ}
              actionId={actionId}
              onSearchChange={setSearch}
              onActionChange={setActionFilter}
              actions={allActions}
            />
          ) : null}
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
            loadingMore={!isItemView && view.kind === "list" ? loadingMore : false}
            onLoadMore={!isItemView && view.kind === "list" ? loadMore : undefined}
          />
        </>
      )}

      <DismissibleAnnouncementModal
        scopeKey="/"
        id="todos-2026-01"
        title="راهنمای سریع"
        description="توی این بخش می‌تونی وارد یکی از دسته‌ها (اینستاگرام، X (توییتر) و ...) بشی و لیست لینک‌های مهم روز رو ببینی. کنار هر لینک، کامنت‌ها و ری‌اکشن‌های پیشنهادی آماده‌ست که می‌تونی مستقیم کپی کنی و استفاده کنی و دکمه انجام شدش رو بزنی، خیلی ساده و سریع!"
        imageUrl="/assets/todos-background.jpg"
      />
    </PageShell>
  );
}
