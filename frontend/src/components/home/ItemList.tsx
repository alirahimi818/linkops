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

export type ListTab = "todo" | "later" | "done" | "hidden";

function pickRandom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getComments(
  item: any,
): Array<{ id?: string; text?: string } | string> {
  if (!item?.comments) return [];
  if (Array.isArray(item.comments)) return item.comments;
  return [];
}

function commentText(c: any) {
  if (typeof c === "string") return c;
  return String(c?.text ?? "");
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
    if (props.tab === "later") return "فعلاً چیزی برای «بعداً» ندارید.";
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
        <TabButton
          active={props.tab === "todo"}
          onClick={() => props.onTabChange("todo")}
        >
          انجام‌نشده
        </TabButton>
        <TabButton
          active={props.tab === "later"}
          onClick={() => props.onTabChange("later")}
        >
          بعداً
        </TabButton>
        <TabButton
          active={props.tab === "done"}
          onClick={() => props.onTabChange("done")}
        >
          انجام‌شده
        </TabButton>
        <TabButton
          active={props.tab === "hidden"}
          onClick={() => props.onTabChange("hidden")}
        >
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

            return (
              <Card key={item.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      {catImg ? (
                        <img
                          src={catImg}
                          alt={item.category_name ?? "category"}
                          className="mt-0.5 h-6 w-6 rounded-md border border-zinc-200 bg-white object-contain p-1"
                        />
                      ) : (
                        <div className="mt-0.5 h-6 w-6 rounded-md border border-zinc-200 bg-zinc-50" />
                      )}

                      <div className="min-w-0 flex-1">
                        {/* Title NOT a link */}
                        <div
                          className="text-lg font-semibold text-zinc-900"
                          dir="auto"
                        >
                          {item.title}
                        </div>

                        {/* URL row + copy */}
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

                        {Array.isArray(item.actions) &&
                        item.actions.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.actions.map((a: any) => (
                              <Badge key={a.id}>{a.label ?? a.name}</Badge>
                            ))}
                          </div>
                        ) : null}

                        {/* Comment controls */}
                        {hasComments ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button
                              variant="ghost"
                              onClick={() => toggleComments(item.id)}
                            >
                              {isOpen
                                ? "بستن پیام‌های پیشنهادی"
                                : `پیام‌های پیشنهادی (${comments.length})`}
                            </Button>
                            <SplitAction
                              dir="rtl"
                              disabled={!hasComments}
                              primary={
                                <CopyPillDynamic
                                  label="کپی رندوم"
                                  dir="auto"
                                  title="یک پیام پیشنهادی رندوم کپی می‌شود"
                                  className="rounded-e-none py-2"
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

                        {/* Expanded comments list */}
                        {isOpen && hasComments ? (
                          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                            <div className="mb-2 text-sm font-medium text-zinc-800">
                              پیام‌های پیشنهادی
                            </div>

                            <div className="space-y-2">
                              {comments.map((c: any, idx: number) => {
                                const t = commentText(c);
                                const cid =
                                  typeof c === "string"
                                    ? `s-${idx}`
                                    : (c.id ?? `c-${idx}`);

                                return (
                                  <div
                                    key={cid}
                                    className="rounded-lg border border-zinc-200 bg-white p-3"
                                  >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                      <div
                                        className="min-w-0 whitespace-pre-wrap text-sm text-zinc-800"
                                        dir="auto"
                                      >
                                        {t}
                                      </div>

                                      <div className="shrink-0 flex flex-wrap items-center gap-2 md:justify-end">
                                        <CopyPill
                                          value={t}
                                          label="کپی"
                                          dir="auto"
                                        />

                                        <Button
                                          variant="ghost"
                                          onClick={() => openTweet(t)}
                                          title="ساخت توییت با این متن"
                                        >
                                          توییت
                                        </Button>

                                        <Button
                                          variant="ghost"
                                          onClick={() => openReply(url, t)}
                                          title={
                                            xEnabled
                                              ? "ریپلای به همان توییت"
                                              : "این لینک استتوس نیست، به توییت معمولی می‌رود"
                                          }
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
                </div>

                {/* Status buttons */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {props.tab === "todo" ? (
                    <>
                      <Button onClick={() => props.onMark(item.id, "done")}>
                        انجام شد
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => props.onMark(item.id, "later")}
                      >
                        بعداً انجام می‌دم
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => props.onMark(item.id, "hidden")}
                      >
                        مخفی
                      </Button>
                    </>
                  ) : props.tab === "later" ? (
                    <>
                      <Button onClick={() => props.onMark(item.id, "done")}>
                        انجام شد
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => backToTodo(item.id)}
                      >
                        برگرد به انجام‌نشده
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => props.onMark(item.id, "hidden")}
                      >
                        مخفی
                      </Button>
                    </>
                  ) : props.tab === "done" ? (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => backToTodo(item.id)}
                      >
                        برگرد به انجام‌نشده
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => props.onMark(item.id, "later")}
                      >
                        بزن برای بعداً
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => props.onMark(item.id, "hidden")}
                      >
                        مخفی
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => backToTodo(item.id)}
                      >
                        نمایش دوباره
                      </Button>
                      <Button onClick={() => props.onMark(item.id, "done")}>
                        انجام شد
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => props.onMark(item.id, "later")}
                      >
                        بزن برای بعداً
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
