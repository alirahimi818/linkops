import React from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  className?: string;
  dir?: "rtl" | "ltr" | "auto"; // default: auto
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "placeholder" | "type" | "autoComplete" | "className" | "dir"
>;

export default function Input({
  value,
  onChange,
  placeholder,
  type,
  autoComplete,
  className,
  dir,
  ...rest
}: Props) {
  return (
    <input
      dir={dir ?? "auto"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      autoComplete={autoComplete}
      className={[
        "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[16px] text-zinc-900 placeholder:text-zinc-400",
        "focus:outline-none focus:ring-2 focus:ring-zinc-200",
        className ?? "",
      ].join(" ")}
      {...rest}
    />
  );
}
