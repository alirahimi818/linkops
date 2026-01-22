import { useMemo, useState } from "react";
import Input from "../ui/Input";
import Badge from "../ui/Badge";

type Props = {
  label?: string;
  placeholder?: string;
  value: string[];
  onChange: (next: string[]) => void;
  maxItems?: number;
  maxLen?: number;
};

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

function splitTokens(s: string): string[] {
  return s
    .split(/[,\n]/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function TokenInput({
  label,
  placeholder,
  value,
  onChange,
  maxItems = 10,
  maxLen = 60,
}: Props) {
  const [draft, setDraft] = useState("");

  const countLabel = useMemo(() => `${value.length} / ${maxItems}`, [value.length, maxItems]);

  function commitDraft() {
    const tokens = splitTokens(draft).map((t) => t.slice(0, maxLen));
    if (tokens.length === 0) return;

    const merged = uniq([...value, ...tokens]).slice(0, maxItems);
    onChange(merged);
    setDraft("");
  }

  function removeToken(t: string) {
    onChange(value.filter((x) => x !== t));
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-zinc-800">{label ?? "Tokens"}</div>
        <div className="text-xs text-zinc-500">{countLabel}</div>
      </div>

      <Input
        value={draft}
        onChange={setDraft}
        placeholder={placeholder ?? 'Type and press Enter or ","'}
        onKeyDown={(e: any) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commitDraft();
          }
        }}
      />

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => removeToken(t)}
              className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-200 transition"
              title="Click to remove"
            >
              <Badge>{t}</Badge>
              <span className="text-zinc-500">×</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
