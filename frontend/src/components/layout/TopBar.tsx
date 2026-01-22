import React from "react";

export default function TopBar(props: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{props.title}</h1>
        {props.subtitle ? <div className="mt-1 text-sm text-zinc-500">{props.subtitle}</div> : null}
      </div>
      {props.right ?? null}
    </div>
  );
}
