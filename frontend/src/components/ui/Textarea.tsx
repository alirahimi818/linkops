import React from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  minHeightClassName?: string;
  dir?: "rtl" | "ltr" | "auto"; // default: auto
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "placeholder" | "className" | "dir">;

export default function Textarea({
  value,
  onChange,
  placeholder,
  className,
  minHeightClassName,
  dir,
  ...rest
}: Props) {
  return (
    <textarea
      dir={dir ?? "auto"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={[
        minHeightClassName ?? "min-h-[110px]",
        "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400",
        "focus:outline-none focus:ring-2 focus:ring-zinc-200",
        className ?? "",
      ].join(" ")}
      {...rest}
    />
  );
}
