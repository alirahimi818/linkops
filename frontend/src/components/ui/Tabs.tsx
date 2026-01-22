import React from "react";

export function TabButton(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      className={[
        "rounded-full px-4 py-2 text-sm transition border",
        props.active ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100",
      ].join(" ")}
    >
      {props.children}
    </button>
  );
}

export default function Tabs(props: { children: React.ReactNode }) {
  return <nav className="mt-6 flex flex-wrap gap-2">{props.children}</nav>;
}
