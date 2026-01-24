import { useMemo, useState } from "react";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Tabs, { TabButton } from "../ui/Tabs";
import type { StatusMap, ItemStatus } from "../../lib/statusStore";

export type ListTab = "todo" | "later" | "done" | "hidden";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  function getComments(item: any): Array<{ id?: string; text?: string; created_at?: string } | string> {
    if (!item?.comments) return [];
    if (Array.isArray(item.comments)) return item.comments;
    return [];
  }

  function getCommentText(c: any) {
    if (typeof c === "string") return c;
    return String(c?.text ?? "");
  }

  async function doCopy(key: string, text: string) {
    await copyText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 900);
  }

  async function copyRandomComment(item: any) {
    const list = getComments(item);
    if (list.length === 0) return;
    const idx = Math.floor(Math.random() * list.length);
    const txt = getCommentText(list[idx]);
    if (!txt) return;
    await doCopy(`rand:${item.id}`, txt);
  }

  // When user wants to "go back to todo", we must clear status.
  // If your statusStore doesn't support it yet, you can treat "hidden" as reversible by setting to "hidden"? no.
  // For now we use "hidden" | "later" | "done" and "todo" means "no status".
  // So you SHOULD implement clearItemStatus(date,id) later. Here we call onMark with "hidden" etc only.
  // We'll emulate "back to todo" by setting status to "hidden"? not correct.
  // If your onMark supports a special value, change it.
  // We'll keep it explicit: use "hidden" tab button "draft" calls onMark(id, "hidden")? no.
  // Best: allow onMark(id, "todo") to clear in statusStore.
  // We'll use "todo" as ItemStatus here; update ItemStatus union to include "todo" and clear in store.
  async function backToTodo(id: string) {
    await props.onMark(id, null as any);
  }
  return (
    <div dir="rtl" className="text-right">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm text-zinc-600">
          دسته: <span className="font-medium text-zinc-900">{props.title}</span>
        </div>
        <Button variant="ghost" onClick={props.onBack}>
          بازگشت
        </Button>
      </div>

      <Tabs>
        <TabButton active={props.tab === "todo"} onClick={() => props.onTabChange("todo")}>
          انجام‌نشده
        </TabButton>
        <TabButton active={props.tab === "later"} onClick={() => props.onTabChange("later")}>
          بعداً
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
            const isOpen = !!openComments[item.id];
            const comments = getComments(item);
            const commentCount = comments.length;

            const catImg: string | null = item.category_image ?? null;
            const url: string = String(item.url ?? "");

            return (
              <Card key={item.id}>
                {/* Header row: category icon + title (NOT a link) */}
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
                        <div className="text-lg font-semibold text-zinc-900" dir="auto">
                          {item.title}
                        </div>

                        {/* URL row + copy button */}
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

                          <Button
                            variant="ghost"
                            onClick={() => doCopy(`url:${item.id}`, url)}
                            title="کپی لینک"
                          >
                            {copiedKey === `url:${item.id}` ? "کپی شد ✓" : "کپی"}
                          </Button>
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

                        {/* Comments controls */}
                        {commentCount > 0 ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button
                              variant="ghost"
                              onClick={() => toggleComments(item.id)}
                              title="نمایش / مخفی کردن کامنت‌ها"
                            >
                              {isOpen ? "بستن کامنت‌ها" : `کامنت‌ها (${commentCount})`}
                            </Button>

                            <Button
                              variant="secondary"
                              onClick={() => copyRandomComment(item)}
                              title="بدون باز کردن لیست، یکی از کامنت‌ها کپی می‌شود"
                            >
                              {copiedKey === `rand:${item.id}` ? "کپی شد ✓" : "کپی رندوم کامنت"}
                            </Button>
                          </div>
                        ) : null}

                        {isOpen && commentCount > 0 ? (
                          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                            <div className="mb-2 text-sm font-medium text-zinc-800">کامنت‌های پیشنهادی</div>
                            <div className="space-y-2">
                              {comments.map((c: any, idx: number) => {
                                const txt = getCommentText(c);
                                const cid = typeof c === "string" ? `s-${idx}` : (c.id ?? `c-${idx}`);

                                return (
                                  <div
                                    key={cid}
                                    className="rounded-lg border border-zinc-200 bg-white p-3"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0 whitespace-pre-wrap text-sm text-zinc-800" dir="auto">
                                        {txt}
                                      </div>

                                      <div className="shrink-0">
                                        <Button
                                          variant="ghost"
                                          onClick={() => doCopy(`c:${item.id}:${cid}`, txt)}
                                          title="کپی کامنت"
                                        >
                                          {copiedKey === `c:${item.id}:${cid}` ? "✓" : "کپی"}
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

                {/* Actions row depending on current tab */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {props.tab === "todo" ? (
                    <>
                      <Button onClick={() => props.onMark(item.id, "done")}>انجام شد</Button>
                      <Button variant="secondary" onClick={() => props.onMark(item.id, "later")}>
                        بعداً انجام می‌دم
                      </Button>
                      <Button variant="ghost" onClick={() => props.onMark(item.id, "hidden")}>
                        مخفی
                      </Button>
                    </>
                  ) : props.tab === "later" ? (
                    <>
                      <Button onClick={() => props.onMark(item.id, "done")}>انجام شد</Button>
                      <Button variant="secondary" onClick={() => backToTodo(item.id)}>
                        برگرد به انجام‌نشده
                      </Button>
                      <Button variant="ghost" onClick={() => props.onMark(item.id, "hidden")}>
                        مخفی
                      </Button>
                    </>
                  ) : props.tab === "done" ? (
                    <>
                      <Button variant="secondary" onClick={() => backToTodo(item.id)}>
                        برگرد به انجام‌نشده
                      </Button>
                      <Button variant="ghost" onClick={() => props.onMark(item.id, "later")}>
                        بزن برای بعداً
                      </Button>
                      <Button variant="ghost" onClick={() => props.onMark(item.id, "hidden")}>
                        مخفی
                      </Button>
                    </>
                  ) : (
                    // hidden tab
                    <>
                      <Button variant="secondary" onClick={() => backToTodo(item.id)}>
                        نمایش دوباره
                      </Button>
                      <Button onClick={() => props.onMark(item.id, "done")}>انجام شد</Button>
                      <Button variant="ghost" onClick={() => props.onMark(item.id, "later")}>
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
