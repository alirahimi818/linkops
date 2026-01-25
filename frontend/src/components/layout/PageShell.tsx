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
        ) : (
          <footer className="mt-10 text-xs text-zinc-500">
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4 border-zinc-200 justify-center">
              <a href="/" className=" border py-1.5 px-3 rounded-2xl bg-white text-zinc-800 hover:bg-zinc-100 text-sm font-semibold">صفحه اصلی</a>
              <a href="/hashtags-checker" className=" border py-1.5 px-3 rounded-2xl bg-white text-zinc-800 hover:bg-zinc-100 text-sm font-semibold">ابزار بررسی هشتگ‌ها</a>

            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
