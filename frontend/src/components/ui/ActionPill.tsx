import React, { useState } from "react";

export default function ActionPill(props: {
  title: string;
  onClick: () => void | Promise<void>;
  icon?: React.ReactNode;
  children: React.ReactNode;
  successKey?: string; // optional: show success style briefly
  className?: string;
}) {
  const [ok, setOk] = useState(false);

  async function handle() {
    await props.onClick();
    if (props.successKey) {
      setOk(true);
      window.setTimeout(() => setOk(false), 900);
    }
  }

  return (
    <span
      role="button"
      tabIndex={0}
      title={props.title}
      onClick={handle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handle();
        }
      }}
      className={[
        "inline-flex select-none items-center gap-1 rounded-full border px-3 py-1 text-xs transition",
        ok ? "border-green-200 bg-green-50 text-green-800" : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50",
        "cursor-pointer",
        props.className ?? "",
      ].join(" ")}
    >
      {props.icon ? <span className="opacity-80">{props.icon}</span> : null}
      <span>{props.children}</span>
      {ok ? <span className="ms-1">✓</span> : null}
    </span>
  );
}
