import { useEffect, useState } from "react";

export type FilterOption = { id: string; name: string };

function IconX() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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

  // Sync local text when URL param changes externally (e.g. back button / clear all)
  useEffect(() => {
    setLocalText(props.searchText);
  }, [props.searchText]);

  function submit() {
    props.onSearchChange(localText.trim());
  }

  function clearText() {
    setLocalText("");
    props.onSearchChange("");
  }

  function clearAll() {
    setLocalText("");
    props.onSearchChange("");
    props.onActionChange("");
  }

  const activeAction = props.actions.find((a) => a.id === props.actionId);
  const hasFilter = !!props.searchText.trim() || !!props.actionId;

  return (
    <div className="mb-4" dir="rtl">
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {/* Search row */}
        <div className="flex items-center">
          <input
            type="search"
            dir="rtl"
            value={localText}
            onChange={(e) => setLocalText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="جستجو در عنوان، توضیح و لینک…"
            className="min-h-11 flex-1 bg-transparent pr-4 pl-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none"
          />

          {/* Clear text */}
          {localText ? (
            <button
              type="button"
              onClick={clearText}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 transition-colors"
              aria-label="پاک کردن"
            >
              <IconX />
            </button>
          ) : null}

          {/* Search button */}
          <button
            type="button"
            onClick={submit}
            className="flex h-11 w-12 shrink-0 items-center justify-center border-r border-zinc-100 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 transition-colors"
            aria-label="جستجو"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </button>
        </div>

        {/* Divider + Action select */}
        {props.actions.length > 0 ? (
          <>
            <div className="h-px bg-zinc-100" />
            <div className="relative">
              <select
                dir="rtl"
                value={props.actionId}
                onChange={(e) => props.onActionChange(e.target.value)}
                className="w-full appearance-none bg-transparent py-3 pr-4 pl-9 text-sm outline-none"
              >
                <option value="">فیلتر بر اساس اکشن</option>
                {props.actions.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </div>
          </>
        ) : null}
      </div>

      {/* Active filter chips */}
      {hasFilter ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {props.searchText.trim() ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700">
                «{props.searchText}»
              </span>
            ) : null}
            {activeAction ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2.5 py-1 text-xs text-white">
                {activeAction.name}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={clearAll}
            className="shrink-0 text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-700"
          >
            پاک کردن
          </button>
        </div>
      ) : null}
    </div>
  );
}
