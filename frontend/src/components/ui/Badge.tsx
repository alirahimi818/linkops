import React from "react";

export default function Badge(props: { children: React.ReactNode; className?: string }) {
  return (
    <span className={["inline-flex rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700", props.className ?? ""].join(" ")}>
      {props.children}
    </span>
  );
}
