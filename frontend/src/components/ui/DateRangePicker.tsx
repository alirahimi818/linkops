type Range = { from: string; to: string };

function isValidDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

// Expect YYYY-MM-DD, lexical compare works for dates in this format
function clampRange(r: Range): Range {
  const from = isValidDate(r.from) ? r.from : "";
  const to = isValidDate(r.to) ? r.to : "";
  if (!from || !to) return r;

  if (from <= to) return { from, to };
  // swap if user picks reversed
  return { from: to, to: from };
}

export default function DateRangePicker(props: {
  value: Range;
  onChange: (v: Range) => void;
  className?: string;
  titleFrom?: string;
  titleTo?: string;
}) {
  const v = clampRange(props.value);

  return (
    <div className={["flex items-center gap-2", props.className ?? ""].join(" ")}>
      <input
        dir="ltr"
        type="date"
        value={v.from}
        onChange={(e) => props.onChange(clampRange({ from: e.target.value, to: v.to }))}
        title={props.titleFrom ?? "از تاریخ"}
        className={[
          "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[16px] text-zinc-900",
          "focus:outline-none focus:ring-2 focus:ring-zinc-200",
        ].join(" ")}
      />

      <span className="text-zinc-500 text-sm">تا</span>

      <input
        dir="ltr"
        type="date"
        value={v.to}
        onChange={(e) => props.onChange(clampRange({ from: v.from, to: e.target.value }))}
        title={props.titleTo ?? "تا تاریخ"}
        className={[
          "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[16px] text-zinc-900",
          "focus:outline-none focus:ring-2 focus:ring-zinc-200",
        ].join(" ")}
      />
    </div>
  );
}
