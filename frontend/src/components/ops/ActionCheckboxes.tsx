import type { Action } from "../../lib/api";

function toggleId(list: string[], id: string, maxSelect?: number) {
  if (list.includes(id)) return list.filter((x) => x !== id);
  if (typeof maxSelect === "number" && list.length >= maxSelect) return list;
  return [...list, id];
}

export default function ActionCheckboxes(props: {
  label?: string;
  actions: Action[];
  value: string[]; // selected action ids
  onChange: (next: string[]) => void;
  maxSelect?: number;
  disabled?: boolean;
  emptyHint?: string;
}) {
  const disabled = props.disabled ?? false;

  const allIds = props.actions.map((a) => a.id);
  const selectedSet = new Set(props.value);

  const selectedCount = props.value.length;
  const totalCount = allIds.length;

  const isAllSelected = totalCount > 0 && selectedCount >= totalCount;
  const isNoneSelected = selectedCount === 0;

  function selectAll() {
    if (disabled) return;

    if (typeof props.maxSelect === "number") {
      props.onChange(allIds.slice(0, props.maxSelect));
      return;
    }

    props.onChange(allIds);
  }

  function unselectAll() {
    if (disabled) return;
    props.onChange([]);
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-zinc-900">{props.label ?? "Actions"}</div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-zinc-500">
            {selectedCount} selected
          </div>

          {props.actions.length > 0 ? (
            <button
              type="button"
              disabled={disabled}
              onClick={isAllSelected ? unselectAll : selectAll}
              className={[
                "text-xs underline transition",
                disabled ? "text-zinc-400 cursor-not-allowed" : "text-zinc-700 hover:text-zinc-900",
              ].join(" ")}
              title={isAllSelected ? "Unselect all" : "Select all"}
            >
              {isAllSelected ? "Unselect all" : "Select all"}
            </button>
          ) : null}
        </div>
      </div>

      {props.actions.length === 0 ? (
        <div className="text-sm text-zinc-500">{props.emptyHint ?? "No actions available."}</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {props.actions.map((a) => {
            const checked = selectedSet.has(a.id);

            return (
              <label
                key={a.id}
                className={[
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                  disabled ? "opacity-60 cursor-not-allowed" : "",
                  checked ? "border-zinc-300 bg-zinc-50" : "border-zinc-200 bg-white",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => props.onChange(toggleId(props.value, a.id, props.maxSelect))}
                />
                <span className="font-medium text-zinc-900">{a.label}</span>
                <span className="ml-auto text-xs text-zinc-500">{a.name}</span>
              </label>
            );
          })}
        </div>
      )}

      {typeof props.maxSelect === "number" && props.value.length >= props.maxSelect ? (
        <div className="mt-2 text-xs text-zinc-500">Maximum selected actions reached.</div>
      ) : null}

      {!disabled && !isNoneSelected && !isAllSelected ? (
        <div className="mt-2 text-xs text-zinc-500">
          Tip: You can quickly select everything using <span className="font-medium">Select all</span>.
        </div>
      ) : null}
    </div>
  );
}