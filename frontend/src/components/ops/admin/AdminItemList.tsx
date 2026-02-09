import { useMemo, useState } from "react";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import Badge from "../../ui/Badge";
import { IconPin } from "../../ui/icons";
import AICommentsModal from "../AICommentsModal"; // adjust path if needed

function isGlobalItem(item: any): boolean {
  return item?.is_global === 1 || item?.is_global === true;
}

type AnyComment =
  | string
  | {
      id?: string;
      item_id?: string;
      text?: string;
      translation_text?: string | null;
      author_type?: string | null;
      created_at?: string;
    };

function normalizeComments(input: any): Array<{
  text: string;
  translation_text: string | null;
  author_type: string | null;
  created_at: string | null;
}> {
  if (!input) return [];

  if (Array.isArray(input) && input.length > 0 && typeof input[0] === "string") {
    return (input as string[]).map((t) => ({
      text: String(t ?? ""),
      translation_text: null,
      author_type: null,
      created_at: null,
    }));
  }

  if (Array.isArray(input)) {
    return (input as AnyComment[])
      .map((c: any) => ({
        text: String(c?.text ?? "").trim(),
        translation_text:
          typeof c?.translation_text === "string" ? c.translation_text : null,
        author_type: c?.author_type ? String(c.author_type) : null,
        created_at: c?.created_at ? String(c.created_at) : null,
      }))
      .filter((c) => c.text.length > 0);
  }

  return [];
}

function authorTypeLabel(authorType: string | null) {
  const t = (authorType ?? "").toLowerCase().trim();
  if (!t) return null;

  if (t === "admin") return "ادمین";
  if (t === "editor") return "ادیتور";
  if (t === "superadmin") return "سوپرادمین";
  if (t === "user") return "کاربر";
  if (t === "ai") return "AI";

  return authorType;
}

export default function AdminItemList(props: {
  date: string;
  items: any[];
  loading: boolean;

  openComments: Record<string, boolean>;
  toggleComments: (id: string) => void;

  onDelete: (id: string) => void;
  onStartEdit: (item: any) => void;

  // parent should reload list on save-to-db
  onRefresh: () => void;

  // Needed for modal: hashtag whitelist
  whitelist: Set<string>;
}) {
  const [aiOpen, setAiOpen] = useState(false);
  const [aiItem, setAiItem] = useState<any | null>(null);

  const aiExistingPool = useMemo(() => {
    if (!aiItem) return [];
    const comments = normalizeComments(aiItem.comments);
    return comments.map((c) => ({ text: c.text }));
  }, [aiItem]);

  function openAIModal(item: any) {
    setAiItem(item);
    setAiOpen(true);
  }

  function closeAIModal() {
    setAiOpen(false);
    setAiItem(null);
  }

  return (
    <section className="mt-6">
      <div className="mb-3 text-sm text-zinc-500">
        آیتم‌های تاریخ {props.date}
      </div>

      {/* AI Modal mounted once */}
      {aiOpen && aiItem ? (
        <AICommentsModal
          open={aiOpen}
          mode="admin"
          itemId={String(aiItem.id)}
          titleFa={String(aiItem.title ?? "").trim()}
          descriptionFa={String(aiItem.description ?? "").trim()}
          whitelist={props.whitelist}
          existingCommentsPool={aiExistingPool}
          onSaved={() => {
            closeAIModal();
            props.onRefresh();
          }}
          onClose={closeAIModal}
        />
      ) : null}

      {props.loading ? (
        <div className="text-zinc-500">در حال بارگذاری…</div>
      ) : props.items.length === 0 ? (
        <Card className="p-6 text-zinc-600">هنوز آیتمی ثبت نشده است.</Card>
      ) : (
        <div className="space-y-3">
          {props.items.map((i: any) => {
            const comments = normalizeComments(i.comments);
            const hasComments = comments.length > 0;
            const isOpen = !!props.openComments[i.id];
            const pinned = isGlobalItem(i);

            return (
              <Card key={i.id} className="relative">
                {pinned ? (
                  <div
                    className="absolute -left-2 -top-2 inline-flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 p-2 shadow-sm"
                    title="آیتم همیشگی (Global)"
                    aria-label="Pinned item"
                  >
                    <IconPin className="h-4 w-4" />
                  </div>
                ) : null}

                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col justify-center items-center gap-2">
                    <Button
                      className="w-full"
                      variant="danger"
                      onClick={() => props.onDelete(i.id)}
                    >
                      حذف
                    </Button>

                    <Button
                      className="w-full"
                      variant="info"
                      onClick={() => props.onStartEdit(i)}
                    >
                      ویرایش
                    </Button>

                    <Button
                      className="w-full"
                      variant="success"
                      onClick={() => openAIModal(i)}
                    >
                      AI
                    </Button>

                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={() => props.toggleComments(i.id)}
                      disabled={!hasComments}
                      title={!hasComments ? "کامنتی ثبت نشده است" : undefined}
                    >
                      {isOpen ? "بستن کامنت‌ها" : `کامنت‌ها (${comments.length})`}
                    </Button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-lg ">{i.title}</div>

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
                        ? i.actions.map((a: any) => (
                            <Badge key={a.id}>{a.label ?? a.name}</Badge>
                          ))
                        : null}

                      <span className="text-xs text-zinc-500">
                        توسط {i.created_by_username ?? "نامشخص"} •{" "}
                        {new Date(i.created_at).toLocaleString("fa-IR")}
                      </span>
                    </div>

                    {isOpen && hasComments ? (
                      <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                        <div className="mb-2 text-sm font-medium text-zinc-800">
                          کامنت‌های پیشنهادی
                        </div>

                        <div className="space-y-2">
                          {comments.map((c, idx) => {
                            const label = authorTypeLabel(c.author_type);

                            return (
                              <div
                                key={`${idx}:${c.text.slice(0, 16)}`}
                                className="rounded-lg border border-zinc-200 bg-white p-3 text-sm"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  {label ? <Badge>{label}</Badge> : <span />}

                                  {c.created_at ? (
                                    <span className="text-xs text-zinc-500">
                                      {new Date(c.created_at).toLocaleString("fa-IR")}
                                    </span>
                                  ) : null}
                                </div>

                                <div
                                  className="mt-2 whitespace-pre-wrap text-sm text-zinc-800"
                                  dir="auto"
                                >
                                  {c.text}
                                </div>

                                {c.translation_text ? (
                                  <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                                    <div className="mb-1 text-xs font-medium text-zinc-700">
                                      ترجمه
                                    </div>
                                    <div
                                      className="whitespace-pre-wrap text-sm text-zinc-700"
                                      dir="rtl"
                                    >
                                      {c.translation_text}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
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
