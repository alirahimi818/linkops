import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "warning" | "info";

export default function Button(props: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  variant?: Variant;
  title?: string;
}) {
  const variant = props.variant ?? "primary";

  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed";

  const styles: Record<Variant, string> = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-800",
    secondary: "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-100 font-medium",
    ghost: "text-zinc-700 hover:bg-zinc-100 font-medium",
    danger: "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-medium",
    success: "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 font-medium",
    warning: "border border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 font-medium",
    info: "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium",
  };

  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      aria-disabled={props.disabled ? true : undefined}
      className={[base, styles[variant], props.className ?? ""].join(" ")}
      title={props.title}
    >
      {props.children}
    </button>
  );
}
