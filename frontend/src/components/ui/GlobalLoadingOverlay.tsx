import { useEffect, useState } from "react";
import { subscribeLoading } from "../../lib/loadingStore";

export default function GlobalLoadingOverlay() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeLoading(setActive);
    return () => {
      unsubscribe();
    };
  }, []);

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] bg-white/30 backdrop-blur-[2px] flex items-center justify-center"
      role="presentation"
      aria-hidden="true"
    >
      <div className="rounded-full border border-zinc-200 bg-white p-3 shadow-sm">
        <svg
          className="h-5 w-5 animate-spin text-zinc-500"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.2"
          />
          <path
            d="M21 12a9 9 0 00-9-9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
