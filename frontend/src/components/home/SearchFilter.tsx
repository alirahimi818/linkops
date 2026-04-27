import { useEffect, useRef, useState } from "react";

export type FilterOption = { id: string; name: string };

function IconSearch() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-zinc-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function IconX() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export default function SearchFilter(props: {
  searchText: string;
  actionId: string;
  onSearchChange: (q: string) => void;
  onActionChange: (id: string) => void;
  actions: FilterOption[];
}) {
  const [localText, setLocalText] = useState(props.searchText);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalText(props.searchText);
  }, [props.searchText]);

  function handleTextChange(v: string) {
    setLocalText(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      props.onSearchChange(v.trim());
    }, 400);
  }

  function clearText() {
    setLocalText("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    props.onSearchChange("");
  }

  const activeAction = props.actions.find((a) => a.id === props.actionId);
  const hasFilter = !!props.searchText.trim() || !!props.actionId;

  return (
    <div className="mb-3 flex flex-col gap-2" dir="rtl">
      {/* Search input */}
      <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-100 transition-shadow">
        <IconSearch />
        <input
          type="search"
          dir="rtl"
          value={localText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="جستجو در عنوان، توضیح و لینک…"
          className="min-h-11 flex-1 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 outline-none"
        />
        {localText ? (
          <button
            type="button"
            onClick={clearText}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
            aria-label="پاک کردن جستجو"
          >
            <IconX />
          </button>
        ) : null}
      </div>

      {/* Action select */}
      {props.actions.length > 0 ? (
        <div className="relative">
          <select
            dir="rtl"
            value={props.actionId}
            onChange={(e) => props.onActionChange(e.target.value)}
            className={[
              "w-full appearance-none rounded-2xl border px-4 py-3 text-sm outline-none transition-colors",
              props.actionId
                ? "border-zinc-800 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-700",
            ].join(" ")}
          >
            <option value="">فیلتر بر اساس اکشن</option>
            {props.actions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {/* Custom dropdown arrow */}
          <span
            className={[
              "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2",
              props.actionId ? "text-white/70" : "text-zinc-400",
            ].join(" ")}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </div>
      ) : null}

      {/* Active filter summary + clear all */}
      {hasFilter ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
            {props.searchText.trim() ? (
              <span className="rounded-md bg-zinc-200 px-2 py-0.5 text-zinc-700">
                «{props.searchText}»
              </span>
            ) : null}
            {activeAction ? (
              <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-white">
                {activeAction.name}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              clearText();
              props.onActionChange("");
            }}
            className="shrink-0 text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-800"
          >
            پاک کردن همه
          </button>
        </div>
      ) : null}
    </div>
  );
}
