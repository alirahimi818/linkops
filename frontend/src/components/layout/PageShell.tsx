import React from "react";
import OfflineBanner from "../ui/OfflineBanner";
import PullToRefreshSpinner from "../ui/PullToRefreshSpinner";
import { useNativeLikePullToRefresh } from "../../hooks/useNativeLikePullToRefresh";
import PullToRefreshWrap from "../ui/PullToRefreshWrap";

export default function PageShell(props: {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  maxWidthClassName?: string; // default: max-w-3xl
  dir?: "rtl" | "ltr"; // default: rtl
}) {
  const maxW = props.maxWidthClassName ?? "max-w-3xl";
  const dir = props.dir ?? "rtl";

  const { offset, isAnimatingBack, isRefreshingUI } =
    useNativeLikePullToRefresh(() => window.location.reload());

  return (
    <>
      <PullToRefreshSpinner visible={isRefreshingUI} />
      <PullToRefreshWrap offset={offset} isAnimatingBack={isAnimatingBack}>
        <div
          dir={dir}
          className={[
            "min-h-screen bg-zinc-50 text-zinc-900",
            dir === "rtl" ? "text-right" : "text-left",
            props.className ?? "",
          ].join(" ")}
        >
          <div className={["mx-auto px-4 py-10", maxW].join(" ")}>
            {props.header ? (
              <header className="mb-6">{props.header}</header>
            ) : null}
            <main>{props.children}</main>
            {props.footer ? (
              <footer className="mt-10 text-xs text-zinc-500">
                {props.footer}
              </footer>
            ) : (
              <footer className="mt-10 text-xs text-zinc-500">
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4 border-zinc-200 justify-center">
                  <a
                    href="/"
                    className=" border py-1.5 px-3 rounded-2xl bg-white text-zinc-800 hover:bg-zinc-100 text-sm font-semibold"
                  >
                    بازگشت به صفحه اصلی
                  </a>
                </div>
              </footer>
            )}
          </div>
          <OfflineBanner />
        </div>
      </PullToRefreshWrap>
    </>
  );
}
