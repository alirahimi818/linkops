import { useEffect, useId, useMemo, useRef, useState } from "react";
import Button from "./Button";

export type SplitActionItem = {
  key: string;
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  title?: string;
};

export default function SplitAction(props: {
  primary: React.ReactNode;            // Inject any primary control (CopyPillDynamic, Button, etc.)
  actions: SplitActionItem[];          // Dropdown items
  disabled?: boolean;

  dir?: "rtl" | "ltr";
  align?: "start" | "end";
  className?: string;

  arrowVariant?: "primary" | "secondary" | "ghost" | "danger" | "success" | "warning" | "info";
  arrowTitle?: string;
}) {
  const dir = props.dir ?? "rtl";
  const align = props.align ?? "end";
  const arrowVariant = props.arrowVariant ?? "secondary";

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const actions = props.actions ?? [];
  const hasActions = useMemo(() => actions.length > 0, [actions]);

  function close() {
    setOpen(false);
  }

  function toggle() {
    if (!hasActions || props.disabled) return;
    setOpen((p) => !p);
  }

  useEffect(() => {
    if (!open) return;

    function onDocClick(e: MouseEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      close();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function runAction(fn: () => void | Promise<void>) {
    try {
      await fn();
    } finally {
      close();
    }
  }

  const menuAlignClass =
    align === "end"
      ? dir === "rtl"
        ? "left-0"
        : "right-0"
      : dir === "rtl"
        ? "right-0"
        : "left-0";

  return (
    <div
      ref={rootRef}
      dir={dir}
      className={["relative inline-flex", props.className ?? ""].join(" ")}
    >
      {/* Primary slot (keeps exact UX of injected component) */}
      <div className="inline-flex [&>*]:rounded-e-none">
        {props.primary}
      </div>

      {/* Arrow button */}
      <Button
        variant={arrowVariant as any}
        onClick={toggle}
        disabled={props.disabled || !hasActions}
        title={props.arrowTitle ?? (hasActions ? "More actions" : undefined)}
        className="rounded-s-none px-3 text-xs"
      >
        <span className="inline-block translate-y-[1px]">▾</span>
      </Button>

      {/* Menu */}
      {open ? (
        <div
          id={menuId}
          role="menu"
          className={[
            "absolute z-50 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm",
            menuAlignClass,
          ].join(" ")}
        >
          <div className="p-1">
            {actions.map((a) => (
              <button
                key={a.key}
                type="button"
                role="menuitem"
                disabled={a.disabled}
                title={a.title}
                onClick={() => runAction(a.onClick)}
                className={[
                  "w-full rounded-lg px-3 py-2 text-right text-sm transition",
                  "hover:bg-zinc-100",
                  "disabled:opacity-50 disabled:pointer-events-none",
                  "text-zinc-800",
                ].join(" ")}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
