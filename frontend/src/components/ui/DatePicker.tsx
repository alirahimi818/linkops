export default function DatePicker(props: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  title?: string;
}) {
  return (
    <input
      dir="ltr"
      type="date"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      title={props.title}
      className={[
        "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[16px] text-zinc-900",
        "focus:outline-none focus:ring-2 focus:ring-zinc-200",
        props.className ?? "",
      ].join(" ")}
    />
  );
}
