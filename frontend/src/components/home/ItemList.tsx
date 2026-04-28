// /frontend/src/components/home/ItemList.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { TabButton } from "../ui/Tabs";
import type { ItemSettableStatus } from "../../lib/api";

import { copyText } from "../../lib/clipboard";
import CopyPill from "../ui/CopyPill";
import CopyPillDynamic from "../ui/CopyPillDynamic";
import SplitAction from "../ui/SplitAction";

import {
  buildXIntentReplyUrl,
  buildXIntentTweetUrl,
  isXUrl,
} from "../../lib/socialIntents";
import { IconPin } from "../ui/icons";
import ShareSheet from "../ui/ShareSheet";
import { isIOSStandalonePWA, openExternal } from "../../lib/openExternal";
import CommentRowUI from "./CommentRowUI";
import AICommentButton from "./AICommentButton";

export type ListTab = "todo" | "later" | "done" | "hidden";

type CommentRow = {
  id?: string;
  text?: string;
  translation_text?: string | null;
};

function pickRandom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getComments(item: any): Array<CommentRow | string> {
  if (!item?.comments) return [];
  if (Array.isArray(item.comments)) return item.comments;
  return [];
}

function commentText(c: any) {
  // Copy/random must ALWAYS use original text
  if (typeof c === "string") return c;
  return String(c?.text ?? "");
}

function commentTranslation(c: any): string | null {
  if (!c || typeof c === "string") return null;
  const t = String(c?.translation_text ?? "").trim();
  return t ? t : null;
}

function isGlobalItem(item: any): boolean {
  return item?.is_global === 1 || item?.is_global === true;
}

export default function ItemList(props: {
  title: string;
  itemId: string | null;
  items: any[];
  counts: { todo: number; later: number; done: number; hidden: number };
  tab: ListTab;
  onTabChange: (t: ListTab) => void;
  onMark: (id: string, s: ItemSettableStatus | null) => Promise<void>;
  onBack: () => void;

  // Infinite list controls (optional)
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: (() => void) | undefined;
}) {
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Auto-load more when sentinel scrolls into view
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !props.onLoadMore || !props.hasMore) return;

    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) props.onLoadMore?.(); },
      { rootMargin: "300px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [props.hasMore, props.onLoadMore]);

  const emptyText = useMemo(() => {
    if (props.tab === "todo")
      return "تبریک! فعلا چیزی برای انجام‌دادن نیست، لطفا چند ساعت بعد مجدد بررسی کنید.";
    if (props.tab === "later") return "فعلاً چیزی برای «بعدا» ندارید.";
    if (props.tab === "done") return "هنوز چیزی را انجام‌شده علامت نزده‌اید.";
    if (props.tab === "hidden") return "هیچ آیتمی مخفی نشده است.";
    return "موردی وجود ندارد.";
  }, [props.tab]);

  function toggleComments(id: string) {
    setOpenComments((p) => ({ ...p, [id]: !p[id] }));
  }

  async function backToTodo(id: string) {
    await props.onMark(id, null);
  }

  function openTweet(text: string) {
    const url = buildXIntentTweetUrl(text);
    openExternal(url);
  }

  function openReply(itemUrl: string, text: string) {
    const url = buildXIntentReplyUrl(itemUrl, text);
    if (!url) {
      openTweet(text);
      return;
    }
    openExternal(url);
  }

  return (
    <div dir="rtl" className="text-right">
      {props.itemId ? null : (
        <div className="sticky top-0 z-20 -mx-4 mb-3 bg-zinc-50/95 px-4 pb-3 pt-1 backdrop-blur-sm">
          {/* Back link */}
          <button
            type="button"
            onClick={props.onBack}
            className="mb-3 mt-1 flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path d="m9 18 6-6-6-6" />
            </svg>
            بازگشت به دسته‌ها
          </button>

          {/* Tabs — horizontal scroll, no wrap */}
          <div className="flex gap-2 pb-0.5 scrollbar-none" dir="rtl">
            <TabButton active={props.tab === "todo"} onClick={() => props.onTabChange("todo")} count={props.counts.todo}>
              انجام‌نشده
            </TabButton>
            <TabButton active={props.tab === "later"} onClick={() => props.onTabChange("later")} count={props.counts.later}>
              بعدا
            </TabButton>
            <TabButton active={props.tab === "done"} onClick={() => props.onTabChange("done")} count={props.counts.done}>
              انجام‌شده
            </TabButton>
            <TabButton active={props.tab === "hidden"} onClick={() => props.onTabChange("hidden")} count={props.counts.hidden}>
              مخفی‌ها
            </TabButton>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-3">
        {props.items.length === 0 ? (
          <Card className="p-6 text-zinc-600">{emptyText}</Card>
        ) : (
          props.items.map((item: any) => {
            const catImg: string | null = item.category_image ?? null;
            const url: string = String(item.url ?? "");
            const isOpen = !!openComments[item.id];
            const comments = getComments(item);
            const hasComments = comments.length > 0;

            const xEnabled = isXUrl(url);
            const pinned = isGlobalItem(item);
            const isReportOrBlock = (item.actions ?? []).some((a: any) => {
              const n = String(a?.name ?? "").toLowerCase().trim();
              const l = String(a?.label ?? "").toLowerCase().trim();
              return n === "ریپورت" || n === "report" || n === "بلاک" || n === "block" || l === "ریپورت" || l === "بلاک";
            });

            const isPwaIOS = isIOSStandalonePWA();

            return (
              <Card key={item.id} className="relative">
                {pinned ? (
                  <div
                    className="absolute -left-2 -top-2 inline-flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 p-2 shadow-sm"
                    title="آیتم همیشگی"
                    aria-label="Pinned item"
                  >
                    <IconPin className="h-4 w-4" />
                  </div>
                ) : null}

                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex gap-2 items-center">
                        {catImg ? (
                          <img
                            src={catImg}
                            alt={item.category_name ?? "category"}
                            className="mt-0.5 h-8 w-8 rounded-md border border-zinc-200 bg-white object-contain p-1"
                          />
                        ) : (
                          <div className="mt-0.5 h-8 w-8 rounded-md border border-zinc-200 bg-zinc-50" />
                        )}

                        <div
                          className="text-lg  text-zinc-900"
                          dir="auto"
                        >
                          {item.title}
                        </div>
                      </div>

                      <div className="mt-1 flex items-center gap-2">
                        <a
                          href={url}
                          target={isPwaIOS ? undefined : "_blank"}
                          onClick={(e) => {
                            if (isPwaIOS) return;
                            e.preventDefault();
                            window.open(url, "_blank", "noopener,noreferrer");
                          }}
                          rel="noreferrer"
                          className="min-w-0 truncate text-sm text-zinc-600 underline"
                          dir="ltr"
                        >
                          {url}
                        </a>

                        <SplitAction
                          dir="rtl"
                          primary={
                            <CopyPill
                              className="rounded-e-none rounded-s-xl py-2"
                              value={url}
                              label="کپی لینک"
                              dir="auto"
                            />
                          }
                          actions={[
                            {
                              key: "openExternal",
                              label: "بازکردن لینک در صفحه جدید",
                              onClick: async () => {
                                openExternal(url);
                              },
                              title: "بازکردن لینک در صفحه جدید",
                            },
                          ]}
                        />

                        <ShareSheet
                          itemId={String(item.id)}
                          title={String(item.title ?? "")}
                          buttonLabel="اشتراک"
                        />
                      </div>

                      <div className="mt-2 text-sm text-zinc-600 whitespace-pre-line" dir="rtl">
                        {item.description}
                      </div>

                      <div className="flex flex-wrap justify-between items-center gap-2 mt-2">
                        {Array.isArray(item.actions) &&
                        item.actions.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {item.actions.map((a: any) => {
                              const label = a.label ?? a.name;
                              const isReport =
                                String(a.name ?? "").trim() === "report" ||
                                String(a.name ?? "").trim() === "block";
                              return (
                                <Badge
                                  key={a.id}
                                  className={
                                    isReport
                                      ? "bg-red-100! text-red-700!"
                                      : ""
                                  }
                                >
                                  {label}
                                </Badge>
                              );
                            })}
                          </div>
                        ) : null}
                        <div className="text-zinc-400 text-sm">{item.date}</div>
                      </div>

                      {(hasComments || xEnabled) ? (
                        <div className="mt-3 flex flex-wrap items-center justify-between md:justify-start gap-2">
                          {hasComments ? (
                            <>
                              <Button
                                variant="info"
                                className="px-3! text-xs"
                                onClick={() => toggleComments(item.id)}
                              >
                                {isOpen
                                  ? "بستن پیام‌ها"
                                  : `پیام‌های پیشنهادی (${comments.length})`}
                              </Button>

                              {xEnabled ? (
                                <SplitAction
                                  dir="rtl"
                                  disabled={!hasComments}
                                  primary={
                                    <CopyPillDynamic
                                      label="کپی رندوم"
                                      dir="auto"
                                      title="یک پیام پیشنهادی رندوم کپی می‌شود"
                                      className="rounded-e-none rounded-s-xl py-2"
                                      getValue={() => {
                                        const list = getComments(item);
                                        if (!list.length) return null;
                                        const t = commentText(pickRandom(list));
                                        return t.trim() ? t : null;
                                      }}
                                    />
                                  }
                                  actions={[
                                    {
                                      key: "copyAndTweet",
                                      label: "کپی رندوم و توییت",
                                      onClick: async () => {
                                        const list = getComments(item);
                                        if (!list.length) return;
                                        const t = commentText(pickRandom(list));
                                        if (!t.trim()) return;

                                        await copyText(t);
                                        openTweet(t);
                                      },
                                      title: "کپی رندوم + باز کردن صفحه توییت",
                                    },
                                    {
                                      key: "copyAndReply",
                                      label: "کپی رندوم و ریپلای",
                                      onClick: async () => {
                                        const list = getComments(item);
                                        if (!list.length) return;
                                        const t = commentText(pickRandom(list));
                                        if (!t.trim()) return;

                                        await copyText(t);
                                        openReply(url, t);
                                      },
                                      title: xEnabled
                                        ? "کپی رندوم + باز کردن ریپلای"
                                        : "این لینک استتوس نیست، به توییت معمولی می‌رود",
                                    },
                                  ]}
                                />
                              ) : (
                                <CopyPillDynamic
                                  label="کپی رندوم"
                                  dir="auto"
                                  title="یک پیام پیشنهادی رندوم کپی می‌شود"
                                  className="rounded-xl! py-2"
                                  getValue={() => {
                                    const list = getComments(item);
                                    if (!list.length) return null;
                                    const t = commentText(pickRandom(list));
                                    return t.trim() ? t : null;
                                  }}
                                />
                              )}
                            </>
                          ) : null}

                          {xEnabled && !isReportOrBlock ? (
                            <AICommentButton
                              itemId={item.id}
                              itemUrl={url}
                            />
                          ) : null}
                        </div>
                      ) : null}

                      {isOpen && hasComments ? (
                        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                          <div className="mb-2 text-sm font-medium text-zinc-800">
                            پیام‌های پیشنهادی
                          </div>

                          <div className="space-y-2">
                            {comments.map((c: any, idx: number) => {
                              const t = commentText(c).trim(); // original text (copy source)
                              const tr = commentTranslation(c); // optional translation (display only)

                              const cid =
                                typeof c === "string"
                                  ? `s-${idx}`
                                  : (c.id ?? `c-${idx}`);

                              return (
                                <div
                                  key={cid}
                                  className="rounded-lg border border-zinc-200 bg-white p-3"
                                >
                                  <CommentRowUI
                                    text={t}
                                    translation={tr}
                                    url={url}
                                    xEnabled={xEnabled}
                                    onOpenTweet={openTweet}
                                    onOpenReply={openReply}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap justify-around md:justify-start gap-2 border-t pt-3 border-zinc-200">
                  {props.tab === "todo" ? (
                    <>
                      <Button
                        className="text-xs"
                        variant="success"
                        onClick={() => props.onMark(item.id, "done")}
                      >
                        انجام شد
                      </Button>
                      <Button
                        className="text-xs"
                        variant="warning"
                        onClick={() => props.onMark(item.id, "later")}
                      >
                        بعدا انجام می‌دم
                      </Button>
                      <Button
                        className="text-xs"
                        variant="danger"
                        onClick={() => props.onMark(item.id, "hidden")}
                      >
                        مخفی
                      </Button>
                    </>
                  ) : props.tab === "later" ? (
                    <>
                      <Button
                        className="text-xs"
                        variant="success"
                        onClick={() => props.onMark(item.id, "done")}
                      >
                        انجام شد
                      </Button>
                      <Button
                        className="text-xs"
                        variant="secondary"
                        onClick={() => backToTodo(item.id)}
                      >
                        انجام‌نشده
                      </Button>
                      <Button
                        className="text-xs"
                        variant="danger"
                        onClick={() => props.onMark(item.id, "hidden")}
                      >
                        مخفی
                      </Button>
                    </>
                  ) : props.tab === "done" ? (
                    <>
                      <Button
                        className="text-xs"
                        variant="secondary"
                        onClick={() => backToTodo(item.id)}
                      >
                        انجام‌نشده
                      </Button>
                      <Button
                        className="px-2! text-xs"
                        variant="warning"
                        onClick={() => props.onMark(item.id, "later")}
                      >
                        بعدا انجام می‌دم
                      </Button>
                      <Button
                        className="text-xs"
                        variant="danger"
                        onClick={() => props.onMark(item.id, "hidden")}
                      >
                        مخفی
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        className="px-2! text-sm"
                        variant="secondary"
                        onClick={() => backToTodo(item.id)}
                      >
                        انجام‌نشده
                      </Button>
                      <Button
                        className="text-xs"
                        variant="success"
                        onClick={() => props.onMark(item.id, "done")}
                      >
                        انجام شد
                      </Button>
                      <Button
                        className="px-2! text-xs"
                        variant="warning"
                        onClick={() => props.onMark(item.id, "later")}
                      >
                        بعدا انجام می‌دم
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Infinite scroll sentinel */}
      {props.hasMore ? (
        <div ref={sentinelRef} className="mt-4 flex justify-center py-4">
          {props.loadingMore ? (
            <svg className="h-5 w-5 animate-spin text-zinc-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <div className="h-1" />
          )}
        </div>
      ) : props.items.length > 0 && !props.itemId ? (
        <div className="mt-6 flex flex-col items-center gap-1 pb-2 text-center">
          <div className="h-px w-16 bg-zinc-200" />
          <p className="mt-2 text-xs text-zinc-400">همه آیتم‌ها نمایش داده شدند</p>
        </div>
      ) : null}

      {/* Scroll to top — portaled to body to escape PullToRefreshWrap transform */}
      {!props.itemId ? createPortal(
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-lg hover:border-zinc-300 hover:text-zinc-900 transition-colors cursor-pointer"
          aria-label="بازگشت به بالا"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path d="m18 15-6-6-6 6" />
          </svg>
        </button>,
        document.body,
      ) : null}
    </div>
  );
}
