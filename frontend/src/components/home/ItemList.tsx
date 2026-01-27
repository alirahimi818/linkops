// /frontend/src/components/home/ItemList.tsx
import { useMemo, useState } from "react";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Tabs, { TabButton } from "../ui/Tabs";
import type { StatusMap, ItemStatus } from "../../lib/statusStore";

import { copyText } from "../../lib/clipboard";
import CopyPill from "../ui/CopyPill";
import CopyPillDynamic from "../ui/CopyPillDynamic";
import SplitAction from "../ui/SplitAction";

import {
  buildXIntentReplyUrl,
  buildXIntentTweetUrl,
  isXUrl,
} from "../../lib/socialIntents";
import { PinIcon } from "../ui/icons";

export type ListTab = "todo" | "later" | "done" | "hidden";

function pickRandom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getComments(item: any): Array<{ id?: string; text?: string } | string> {
  if (!item?.comments) return [];
  if (Array.isArray(item.comments)) return item.comments;
  return [];
}

function commentText(c: any) {
  if (typeof c === "string") return c;
  return String(c?.text ?? "");
}

function isGlobalItem(item: any): boolean {
  return item?.is_global === 1 || item?.is_global === true;
}

export default function ItemList(props: {
  title: string;
  items: any[];
  tab: ListTab;
  onTabChange: (t: ListTab) => void;
  onMark: (id: string, s: ItemStatus | null) => Promise<void>;
  statusMap: StatusMap;
  onBack: () => void;
}) {
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});

  const emptyText = useMemo(() => {
    if (props.tab === "todo") return "چیزی برای انجام‌دادن نیست.";
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
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openReply(itemUrl: string, text: string) {
    const url = buildXIntentReplyUrl(itemUrl, text);
    if (!url) {
      openTweet(text);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div dir="rtl" className="text-right">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm text-zinc-600">
          دسته: <span className="font-medium text-zinc-900">{props.title}</span>
        </div>
        <Button variant="secondary" onClick={props.onBack}>
          بازگشت
        </Button>
      </div>

      <Tabs>
        <TabButton active={props.tab === "todo"} onClick={() => props.onTabChange("todo")}>
          انجام‌نشده
        </TabButton>
        <TabButton active={props.tab === "later"} onClick={() => props.onTabChange("later")}>
          بعدا
        </TabButton>
        <TabButton active={props.tab === "done"} onClick={() => props.onTabChange("done")}>
          انجام‌شده
        </TabButton>
        <TabButton active={props.tab === "hidden"} onClick={() => props.onTabChange("hidden")}>
          مخفی‌ها
        </TabButton>
      </Tabs>

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

            return (
              <Card key={item.id} className="relative">
                {pinned ? (
                  <div
                    className="absolute left-3 top-3 inline-flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 p-2 text-amber-700 shadow-sm"
                    title="آیتم همیشگی"
                    aria-label="Pinned item"
                  >
                    <PinIcon className="h-4 w-4" />
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

                        <div className="text-lg font-semibold text-zinc-900" dir="auto">
                          {item.title}
                        </div>
                      </div>

                      <div className="mt-1 flex items-center gap-2">
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 truncate text-sm text-zinc-600 underline"
                          dir="ltr"
                        >
                          {url}
                        </a>

                        <CopyPill value={url} label="کپی لینک" dir="ltr" />
                      </div>

                      <div className="mt-2 text-sm text-zinc-600" dir="auto">
                        {item.description}
                      </div>

                      {Array.isArray(item.actions) && item.actions.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.actions.map((a: any) => (
                            <Badge key={a.id}>{a.label ?? a.name}</Badge>
                          ))}
                        </div>
                      ) : null}

                      {hasComments ? (
                        <div className="mt-3 flex flex-wrap items-center justify-between md:justify-start gap-2">
                          <Button
                            variant="info"
                            className="px-3! text-xs"
                            onClick={() => toggleComments(item.id)}
                          >
                            {isOpen ? "بستن پیام‌ها" : `پیام‌های پیشنهادی (${comments.length})`}
                          </Button>

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
                        </div>
                      ) : null}

                      {isOpen && hasComments ? (
                        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                          <div className="mb-2 text-sm font-medium text-zinc-800">
                            پیام‌های پیشنهادی
                          </div>

                          <div className="space-y-2">
                            {comments.map((c: any, idx: number) => {
                              const t = commentText(c);
                              const cid = typeof c === "string" ? `s-${idx}` : (c.id ?? `c-${idx}`);

                              return (
                                <div key={cid} className="rounded-lg border border-zinc-200 bg-white p-3">
                                  <div className="flex flex-col gap-3">
                                    <div className="min-w-0 whitespace-pre-wrap text-sm text-zinc-800" dir="auto">
                                      {t}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 justify-around md:justify-start border-t pt-3 border-zinc-200">
                                      <CopyPill
                                        value={t}
                                        label="کپی"
                                        dir="auto"
                                        className="rounded-xl py-2 text-sm"
                                      />

                                      <Button variant="secondary" onClick={() => openTweet(t)} title="ساخت توییت با این متن">
                                        توییت
                                      </Button>

                                      <Button
                                        variant="secondary"
                                        onClick={() => openReply(url, t)}
                                        title={xEnabled ? "ریپلای به همان توییت" : "این لینک استتوس نیست، به توییت معمولی می‌رود"}
                                      >
                                        ریپلای
                                      </Button>
                                    </div>
                                  </div>
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
                      <Button className="text-xs" variant="success" onClick={() => props.onMark(item.id, "done")}>
                        انجام شد
                      </Button>
                      <Button className="text-xs" variant="warning" onClick={() => props.onMark(item.id, "later")}>
                        بعدا انجام می‌دم
                      </Button>
                      <Button className="text-xs" variant="danger" onClick={() => props.onMark(item.id, "hidden")}>
                        مخفی
                      </Button>
                    </>
                  ) : props.tab === "later" ? (
                    <>
                      <Button className="text-xs" variant="success" onClick={() => props.onMark(item.id, "done")}>
                        انجام شد
                      </Button>
                      <Button className="text-xs" variant="secondary" onClick={() => backToTodo(item.id)}>
                        انجام‌نشده
                      </Button>
                      <Button className="text-xs" variant="danger" onClick={() => props.onMark(item.id, "hidden")}>
                        مخفی
                      </Button>
                    </>
                  ) : props.tab === "done" ? (
                    <>
                      <Button className="text-xs" variant="secondary" onClick={() => backToTodo(item.id)}>
                        انجام‌نشده
                      </Button>
                      <Button className="px-2! text-sm" variant="warning" onClick={() => props.onMark(item.id, "later")}>
                        بعدا انجام می‌دم
                      </Button>
                      <Button className="text-xs" variant="danger" onClick={() => props.onMark(item.id, "hidden")}>
                        مخفی
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button className="px-2! text-sm" variant="secondary" onClick={() => backToTodo(item.id)}>
                        انجام‌نشده
                      </Button>
                      <Button className="text-xs" variant="success" onClick={() => props.onMark(item.id, "done")}>
                        انجام شد
                      </Button>
                      <Button className="px-2! text-sm" variant="warning" onClick={() => props.onMark(item.id, "later")}>
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
    </div>
  );
}