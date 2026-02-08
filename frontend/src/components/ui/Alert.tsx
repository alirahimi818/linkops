import React from "react";

type Variant = "info" | "success" | "warning" | "error";

export default function Alert(props: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  const variant = props.variant ?? "info";

  const base = "rounded-2xl border p-4 text-sm";

  const styles: Record<Variant, string> = {
    info: "border-zinc-200 bg-white text-zinc-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-rose-200 bg-rose-50 text-rose-700",
  };

  const isError = variant === "error";

  return (
    <div
      className={[base, styles[variant], "text-right", props.className ?? ""].join(" ")}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
    >
      {props.children}
    </div>
  );
}
