import React from "react";

export default function TopBar(props: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  dir?: "rtl" | "ltr"; // default: rtl
}) {
  const dir = props.dir ?? "rtl";

  return (
    <div
      className={[
        "flex items-start justify-between gap-4",
        dir === "rtl" ? "flex-row" : "flex-row-reverse",
      ].join(" ")}
    >
      <div className={dir === "rtl" ? "text-right" : "text-left"}>
        <h1 className="text-2xl font-semibold">{props.title}</h1>
        {props.subtitle ? <div className="mt-1 text-sm text-zinc-500">{props.subtitle}</div> : null}
      </div>

      {props.right ? (
        <div className={dir === "rtl" ? "text-left" : "text-right"}>{props.right}</div>
      ) : null}
    </div>
  );
}
