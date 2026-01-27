import Card from "../../ui/Card";
import Button from "../../ui/Button";
import Badge from "../../ui/Badge";
import { mapItemCommentsToStrings } from "../../../lib/adminItemUtils";
import { PinIcon } from "../../ui/icons";

function isGlobalItem(item: any): boolean {
  return item?.is_global === 1 || item?.is_global === true;
}

export default function AdminItemList(props: {
  date: string;
  items: any[];
  loading: boolean;

  openComments: Record<string, boolean>;
  toggleComments: (id: string) => void;

  onDelete: (id: string) => void;
  onStartEdit: (item: any) => void;
}) {
  return (
    <section className="mt-6">
      <div className="mb-3 text-sm text-zinc-500">آیتم‌های تاریخ {props.date}</div>

      {props.loading ? (
        <div className="text-zinc-500">در حال بارگذاری…</div>
      ) : props.items.length === 0 ? (
        <Card className="p-6 text-zinc-600">هنوز آیتمی ثبت نشده است.</Card>
      ) : (
        <div className="space-y-3">
          {props.items.map((i: any) => {
            const commentStrings = mapItemCommentsToStrings(i.comments);
            const hasComments = commentStrings.length > 0;
            const isOpen = !!props.openComments[i.id];
            const pinned = isGlobalItem(i);

            return (
              <Card key={i.id} className="relative">
                {pinned ? (
                  <div
                    className="absolute left-3 top-3 inline-flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 p-2 text-amber-700 shadow-sm"
                    title="آیتم همیشگی (Global)"
                    aria-label="Pinned item"
                  >
                    <PinIcon className="h-4 w-4" />
                  </div>
                ) : null}

                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col justify-center items-center gap-2">
                    <Button className="w-full" variant="danger" onClick={() => props.onDelete(i.id)}>
                      حذف
                    </Button>

                    <Button className="w-full" variant="info" onClick={() => props.onStartEdit(i)}>
                      ویرایش
                    </Button>

                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={() => props.toggleComments(i.id)}
                      disabled={!hasComments}
                      title={!hasComments ? "کامنتی ثبت نشده است" : undefined}
                    >
                      {isOpen ? "بستن کامنت‌ها" : `کامنت‌ها (${commentStrings.length})`}
                    </Button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-semibold">{i.title}</div>

                    <a
                      className="mt-1 block truncate text-sm text-zinc-600 underline"
                      href={i.url}
                      target="_blank"
                      rel="noreferrer"
                      dir="ltr"
                    >
                      {i.url}
                    </a>

                    <div className="mt-2 text-sm text-zinc-700" dir="auto">
                      {i.description}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {i.category_name ? <Badge>{i.category_name}</Badge> : null}

                      {Array.isArray(i.actions)
                        ? i.actions.map((a: any) => <Badge key={a.id}>{a.label ?? a.name}</Badge>)
                        : null}

                      <span className="text-xs text-zinc-500">
                        توسط {i.created_by_username ?? "نامشخص"} •{" "}
                        {new Date(i.created_at).toLocaleString("fa-IR")}
                      </span>
                    </div>

                    {isOpen && hasComments ? (
                      <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                        <div className="mb-2 text-sm font-medium text-zinc-800">کامنت‌های پیشنهادی</div>

                        <div className="space-y-2">
                          {commentStrings.map((c, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg border border-zinc-200 bg-white p-3 text-sm whitespace-pre-wrap"
                              dir="auto"
                            >
                              {c}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
