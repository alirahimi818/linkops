import React from "react";

export default function Card(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={["rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm", props.className ?? ""].join(" ")}>
      {props.children}
    </div>
  );
}
