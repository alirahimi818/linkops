export default function Textarea(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  minHeightClassName?: string;
}) {
  return (
    <textarea
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      className={[
        props.minHeightClassName ?? "min-h-[110px]",
        "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400",
        "focus:outline-none focus:ring-2 focus:ring-zinc-200",
        props.className ?? "",
      ].join(" ")}
    />
  );
}
