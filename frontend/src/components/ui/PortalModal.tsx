// frontend/src/components/ui/PortalModal.tsx
import { useEffect } from "react";
import Portal from "./Portal";

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function PortalModal(props: {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;

  maxWidthClass?: string; // e.g. "max-w-xl" | "max-w-3xl"
}) {
  useEffect(() => {
    if (!props.open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999]">
        <div
          className="absolute inset-0 bg-black/50"
          onClick={props.onClose}
          aria-hidden="true"
        />

        {/* Use items-start + overflow-y-auto so it never "gets lost" on long pages */}
        <div className="absolute inset-0 overflow-y-auto p-3">
          <div className="min-h-full flex items-start justify-center">
            <div className={clsx("w-full my-10", props.maxWidthClass ?? "max-w-xl")}>
              <div className="rounded-2xl bg-white shadow-xl border border-zinc-200">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-200 p-3">
                  <div className="text-sm font-medium text-zinc-900">
                    {props.title ?? ""}
                  </div>

                  <button
                    type="button"
                    className="rounded-lg px-3 py-1.5 text-sm bg-zinc-100 hover:bg-zinc-200 text-zinc-900"
                    onClick={props.onClose}
                  >
                    بستن
                  </button>
                </div>

                <div className="p-3">{props.children}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
