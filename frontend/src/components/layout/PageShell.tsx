import React from "react";

export default function PageShell(props: {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  maxWidthClassName?: string; // default: max-w-3xl
  dir?: "rtl" | "ltr"; // default: rtl
}) {
  const maxW = props.maxWidthClassName ?? "max-w-3xl";
  const dir = props.dir ?? "rtl";

  return (
    <div
      dir={dir}
      className={[
        "min-h-screen bg-zinc-50 text-zinc-900",
        dir === "rtl" ? "text-right" : "text-left",
        props.className ?? "",
      ].join(" ")}
    >
      <div className={["mx-auto px-4 py-10", maxW].join(" ")}>
        {props.header ? <header className="mb-6">{props.header}</header> : null}
        <main>{props.children}</main>
        {props.footer ? (
          <footer className="mt-10 text-xs text-zinc-500">{props.footer}</footer>
        ) : null}
      </div>
    </div>
  );
}
