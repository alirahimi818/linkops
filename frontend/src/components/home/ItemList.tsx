import { useMemo, useState } from "react";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Tabs, { TabButton } from "../ui/Tabs";
import type { StatusMap, ItemStatus } from "../../lib/statusStore";

export type ListTab = "todo" | "later" | "done" | "hidden";

export default function ItemList(props: {
  title: string;
  items: any[];
  tab: ListTab;
  onTabChange: (t: ListTab) => void;
  onMark: (id: string, s: ItemStatus) => Promise<void>;
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

  function hasComments(item: any) {
    return Array.isArray(item.comments) && item.comments.length > 0;
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
            const commentCount = hasComments(item) ? item.comments.length : 0;

            return (
              <Card key={item.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-lg font-semibold hover:underline"
                      dir="ltr"
                    >
                      {item.title}
                    </a>

                    <div className="mt-1 text-sm text-zinc-600" dir="auto">
                      {item.description}
                    </div>

                    {Array.isArray(item.actions) && item.actions.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.actions.map((a: any) => (
                          <Badge key={a.id}>{a.label ?? a.name}</Badge>
                        ))}
                      </div>
                    ) : null}

                    {commentCount > 0 ? (
                      <div className="mt-3">
                        <Button
                          variant="ghost"
                          onClick={() => toggleComments(item.id)}
                          title="نمایش / مخفی کردن کامنت‌ها"
                        >
                          {isOpen ? "بستن کامنت‌ها" : `کامنت‌ها (${commentCount})`}
                        </Button>
                      </div>
                    ) : null}

                    {isOpen && commentCount > 0 ? (
                      <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                        <div className="mb-2 text-sm font-medium text-zinc-800">کامنت‌های پیشنهادی</div>
                        <div className="space-y-2">
                          {item.comments.map((c: any) => (
                            <div
                              key={c.id ?? c.created_at ?? Math.random()}
                              className="rounded-lg border border-zinc-200 bg-white p-3 text-sm whitespace-pre-wrap"
                              dir="auto"
                            >
                              {c.text ?? String(c)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => props.onMark(item.id, "done")}>انجام شد</Button>

                  <Button variant="secondary" onClick={() => props.onMark(item.id, "later")}>
                    بعداً انجام می‌دم
                  </Button>

                  {props.tab !== "hidden" ? (
                    <Button variant="ghost" onClick={() => props.onMark(item.id, "hidden")}>
                      مخفی
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={() => props.onMark(item.id, undefined as any)}>
                      نمایش دوباره
                    </Button>
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
