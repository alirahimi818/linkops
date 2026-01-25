import { useEffect, useMemo, useState } from "react";
import Input from "../ui/Input";
import Card from "../ui/Card";
import ActionPill from "../ui/ActionPill";
import { IconCopy, IconPlus, IconTrash, IconPencil } from "../ui/icons";
import { copyText } from "../../lib/clipboard";

const STORAGE_KEY = "hashtags:myList:v1";

function normalizeTag(raw: string) {
  let s = (raw ?? "").trim();
  if (!s) return "";
  if (s.startsWith("#")) s = s.slice(1);
  s = s.trim();
  // keep it simple: allow letters/numbers/_ (unicode) + no spaces
  s = s.replace(/\s+/g, "");
  return s;
}

function readStored(): string[] {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v) return [];
    const arr = JSON.parse(v);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => String(x))
      .map(normalizeTag)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function writeStored(tags: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
}

export default function MyHashtags(props: {
  onAppendToText: (tagsText: string) => void; // caller decides where to append
}) {
  const [tags, setTags] = useState<string[]>(() => readStored());
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    writeStored(tags);
  }, [tags]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => t.toLowerCase().includes(q));
  }, [tags, query]);

  function add() {
    const t = normalizeTag(draft);
    if (!t) return;
    setDraft("");
    setTags((prev) => {
      if (prev.includes(t)) return prev;
      return [...prev, t];
    });
  }

  function startEdit(tag: string) {
    setEditing(tag);
    setEditDraft(`#${tag}`);
    setTimeout(() => {
        const inputTag = document.querySelector(".editing-input") as HTMLInputElement;
        inputTag?.focus();
    }, 200);
    
  }

  function saveEdit() {
    if (!editing) return;
    const next = normalizeTag(editDraft);
    if (!next) return;

    setTags((prev) => {
      const replaced = prev.map((t) => (t === editing ? next : t));
      // unique
      return Array.from(new Set(replaced));
    });

    setEditing(null);
    setEditDraft("");
  }

  function cancelEdit() {
    setEditing(null);
    setEditDraft("");
  }

  function remove(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
    if (editing === tag) cancelEdit();
  }

  async function copyWithFlash(key: string, value: string) {
    await copyText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 900);
  }

  function appendAll() {
    if (tags.length === 0) return;
    const text = tags.map((t) => `#${t}`).join(" ");
    props.onAppendToText(text);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div dir="rtl" className="space-y-3 text-right">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="w-full">
            <div className="w-full flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-zinc-900">هشتگ‌های من</div>
                <ActionPill
                    title="افزودن همه هشتگ‌های ذخیره شده به انتهای متن"
                    onClick={appendAll}
                    className={
                        tags.length === 0 ? "opacity-50 pointer-events-none" : ""
                    }
                >
                    افزودن به متن
                </ActionPill>
            </div>
            <div className="mt-1 text-xs text-zinc-500 truncate">
              هشتگ‌های پرکاربرد خودتان را ذخیره کنید و سریع به متن اضافه کنید.
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <Input
            className="w-full md:w-1/2"
            value={draft}
            onChange={setDraft}
            placeholder="مثلاً: #Iran یا Iran"
            dir="ltr"
            onKeyDown={(e: any) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                add();
              }
            }}
          />

          <ActionPill
            title="افزودن"
            onClick={add}
            className={
              !normalizeTag(draft) ? "opacity-50 pointer-events-none" : ""
            }
          >
            <span className="inline-flex items-center gap-1">
              <IconPlus className="h-4 w-4 opacity-70" />
              افزودن
            </span>
          </ActionPill>
        </div>

        <div className="mt-3 border-t pt-3 border-zinc-200">
          <Input
            value={query}
            onChange={setQuery}
            placeholder="جستجو در هشتگ‌های من…"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {filtered.length === 0 ? (
            <div className="text-sm text-zinc-500">
              هنوز هشتگی ذخیره نشده است.
            </div>
          ) : (
            filtered.map((t) => {
              const key = `my:${t}`;
              const active = copiedKey === key;

              return (
                <div
                  key={t}
                  className={[
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition",
                    active
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-zinc-200 bg-white text-zinc-800",
                  ].join(" ")}
                >
                  {editing === t ? (
                    <div className="inline-flex items-center gap-2">
                      <input
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onKeyDown={(e: any) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            saveEdit();
                          }else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelEdit();
                          }
                        }}
                        className="w-44 rounded-md border border-zinc-200 bg-white px-2 py-1 font-mono text-xs outline-none focus:border-zinc-400 editing-input"
                        dir="ltr"
                      />

                      <span
                        role="button"
                        tabIndex={0}
                        onClick={saveEdit}
                        className="cursor-pointer text-emerald-700 hover:text-emerald-800"
                        title="ذخیره"
                      >
                        ✓
                      </span>

                      <span
                        role="button"
                        tabIndex={0}
                        onClick={cancelEdit}
                        className="cursor-pointer text-zinc-500 hover:text-zinc-700"
                        title="لغو"
                      >
                        ✕
                      </span>
                    </div>
                  ) : (
                    <>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={() => copyWithFlash(key, `#${t}`)}
                        className="inline-flex cursor-pointer select-none items-center gap-1 font-mono"
                        dir="ltr"
                        title="کلیک کنید تا کپی شود"
                      >
                        <IconCopy className="h-3.5 w-3.5 opacity-70" />#{t}{" "}
                        {active ? "✓" : ""}
                      </span>

                      <span className="mx-1 h-4 w-px bg-zinc-200" />

                      <span
                        role="button"
                        tabIndex={0}
                        onClick={() => startEdit(t)}
                        className="cursor-pointer text-zinc-500 hover:text-zinc-800"
                        title="ویرایش"
                      >
                        <IconPencil className="h-3.5 w-3.5" />
                      </span>

                      <span
                        role="button"
                        tabIndex={0}
                        onClick={() => remove(t)}
                        className="cursor-pointer text-zinc-500 hover:text-red-700"
                        title="حذف"
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </span>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
