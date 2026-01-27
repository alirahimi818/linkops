import React from "react";

export function TabButton(props: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  const showCount = typeof props.count === "number" && props.count > 0;

  return (
    <button
      onClick={props.onClick}
      className={[
        "relative rounded-full px-4 py-2 text-sm transition border",
        props.active
          ? "bg-zinc-900 text-white border-zinc-900"
          : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100",
      ].join(" ")}
    >
      {props.children}

      {showCount ? (
        <div
          className={[
            "absolute -left-1 -top-1 flex items-center justify-center rounded-full w-4 h-4 border",
            props.active
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-amber-200 bg-amber-50 text-amber-700",
            "",
            "text-xs font-semibold leading-none",
          ].join(" ")}
          aria-label={`${props.count} items`}
        >
          {props.count! > 99 ? "99+" : props.count}
        </div>
      ) : null}
    </button>
  );
}

export default function Tabs(props: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <nav
      className={[
        "mt-6 flex flex-wrap gap-2 justify-end",
        props.className ?? "",
      ].join(" ")}
    >
      {props.children}
    </nav>
  );
}
