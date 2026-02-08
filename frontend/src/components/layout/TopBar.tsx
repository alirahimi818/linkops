import React from "react";

export default function TopBar(props: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  left?: React.ReactNode;
  dir?: "rtl" | "ltr"; // default: rtl
}) {
  const dir = props.dir ?? "rtl";

  return (
    <div
      className={[
        "flex items-start justify-between gap-4",
        dir === "rtl" ? "flex-wrap" : "flex-wrap-reverse",
      ].join(" ")}
    >
      <div className={dir === "rtl" ? "text-right w-full" : "text-left w-full"}>
        {props.left ? (
          <div className="w-full flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-2xl font-semibold">{props.title}</h1>
            {props.left}
          </div>
        ) : (
          <h1 className="text-2xl font-semibold">{props.title}</h1>
        )}
        {props.subtitle ? (
          <div className="mt-1 text-sm text-zinc-500 truncate">
            {props.subtitle}
          </div>
        ) : null}
      </div>

      {props.right ? (
        <div className={dir === "rtl" ? "text-left" : "text-right"}>
          {props.right}
        </div>
      ) : null}
    </div>
  );
}
