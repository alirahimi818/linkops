import React from "react";

export default function Select(props: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
  dir?: "rtl" | "ltr" | "auto"; // default: auto
}) {
  return (
    <select
      dir={props.dir ?? "auto"}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      disabled={props.disabled}
      className={[
        "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[16px] text-zinc-900",
        "focus:outline-none focus:ring-2 focus:ring-zinc-200",
        props.className ?? "",
      ].join(" ")}
    >
      {props.children}
    </select>
  );
}
