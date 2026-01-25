import { useState } from "react";
import Card from "../ui/Card";
import { copyText } from "../../lib/clipboard";

export type TagRow = {
  id: string;
  tag: string;
  priority: number;
  is_active: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizePriority(p: number, minP: number, maxP: number) {
  if (maxP <= minP) return 0.5;
  return (p - minP) / (maxP - minP);
}

export default function PriorityTags(props: {
  title?: string;
  rows: TagRow[];
  maxItems?: number;
  minFontPx?: number; // default 14
  maxFontPx?: number; // default 34
  prefix?: string; // default "#"
}) {
  const title = props.title ?? "Priority tags";
  const maxItems = props.maxItems ?? 30;
  const minFontPx = props.minFontPx ?? 14;
  const maxFontPx = props.maxFontPx ?? 34;
  const prefix = props.prefix ?? "#";

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const active = (props.rows ?? [])
    .filter((r) => r && r.is_active === 1 && String(r.tag ?? "").trim())
    .map((r) => ({
      ...r,
      tag: String(r.tag).trim(),
      priority: Number.isFinite(r.priority) ? Number(r.priority) : 0,
    }))
    .sort((a, b) => {
      const dp = (b.priority ?? 0) - (a.priority ?? 0);
      if (dp !== 0) return dp;
      return a.tag.localeCompare(b.tag, "en");
    })
    .slice(0, maxItems);

  if (active.length === 0) return null;

  const priorities = active.map((r) => r.priority ?? 0);
  const minP = Math.min(...priorities);
  const maxP = Math.max(...priorities);

  async function onCopy(row: TagRow) {
    const text = `${prefix}${String(row.tag).trim()}`;
    await copyText(text);

    setCopiedId(row.id);
    window.setTimeout(() => setCopiedId((prev) => (prev === row.id ? null : prev)), 800);
  }

  return (
    <Card>
      <div className="mb-2 text-sm font-medium text-zinc-800">{title}</div>
      <div className="text-xs text-zinc-500">
        روی هر تگ کلیک کنید تا کپی شود.
      </div>

      <div className="mt-4 space-y-2">
        {active.map((r) => {
          const t = normalizePriority(r.priority ?? 0, minP, maxP);
          const gamma = 0.8;
          const scaled = Math.pow(clamp(t, 0, 1), gamma);
          const fontSize = minFontPx + (maxFontPx - minFontPx) * scaled;

          const text = `${prefix}${r.tag}`;
          const isCopied = copiedId === r.id;

          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onCopy(r)}
              className="w-full text-left flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 hover:bg-zinc-50 transition"
              title="Click to copy"
            >
              <div className="min-w-0">
                <div
                  dir="ltr"
                  className="font-semibold leading-snug text-zinc-900"
                  style={{ fontSize: `${fontSize}px` }}
                >
                  {text}
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700">
                  اولویت {r.priority ?? 0}
                </span>

                <span
                  className={[
                    "text-xs",
                    isCopied ? "text-emerald-700 font-medium" : "text-zinc-400",
                  ].join(" ")}
                >
                  {isCopied ? "کپی شد" : "کپی"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}