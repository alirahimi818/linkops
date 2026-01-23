import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Tabs, { TabButton } from "../ui/Tabs";
import type { StatusMap, ItemStatus } from "../../lib/statusStore";

export type ListTab = "todo" | "later" | "done";

export default function ItemList(props: {
  title: string;
  items: any[];
  tab: ListTab;
  onTabChange: (t: ListTab) => void;
  onMark: (id: string, s: ItemStatus) => Promise<void>;
  statusMap: StatusMap;
}) {
  return (
    <div dir="rtl" className="text-right">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm text-zinc-600">
          دسته: <span className="font-medium text-zinc-900">{props.title}</span>
        </div>
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
      </Tabs>

      <div className="mt-3 space-y-3">
        {props.items.map((item: any) => (
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
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => props.onMark(item.id, "done")}>انجام شد</Button>

              <Button variant="secondary" onClick={() => props.onMark(item.id, "later")}>
                بعداً انجام می‌دم
              </Button>

              <Button variant="ghost" onClick={() => props.onMark(item.id, "hidden")}>
                مخفی
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
