import { useEffect, useRef, useState } from "react";

type Options = {
  enabled?: boolean;
  threshold?: number; // px required to trigger refresh
  maxPull?: number; // max visual pull distance
};

export function useNativeLikePullToRefresh(
  onRefresh: () => void | Promise<void>,
  opts?: Options,
) {
  const enabled = opts?.enabled ?? true;
  const threshold = opts?.threshold ?? 90;
  const maxPull = opts?.maxPull ?? 140;

  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const refreshing = useRef(false);

  const [offset, setOffset] = useState(0);
  const [isAnimatingBack, setIsAnimatingBack] = useState(false);

  const [isRefreshingUI, setIsRefreshingUI] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    function atTop() {
      return window.scrollY <= 0;
    }

    function onTouchStart(e: TouchEvent) {
      if (!atTop()) return;
      if (refreshing.current) return;

      startY.current = e.touches[0].clientY;
      pulling.current = true;
      setIsAnimatingBack(false);
    }

    function onTouchMove(e: TouchEvent) {
      if (!pulling.current || startY.current === null) return;
      if (!atTop()) return;

      const currentY = e.touches[0].clientY;
      const raw = currentY - startY.current;

      if (raw <= 0) {
        setOffset(0);
        return;
      }

      // Prevent native scroll bounce to make it feel like an app
      e.preventDefault();

      // Add resistance (feels native)
      const resisted = Math.min(
        maxPull,
        raw * 0.55 + raw * 0.15 * (raw / maxPull),
      );
      setOffset(resisted);
    }

    async function endPull() {
      if (!pulling.current) return;

      pulling.current = false;
      startY.current = null;

      const shouldRefresh = offset >= threshold;

      if (shouldRefresh && !refreshing.current) {
        refreshing.current = true;
        setIsRefreshingUI(true);

        setIsAnimatingBack(true);
        setOffset(threshold);

        window.setTimeout(async () => {
          try {
            await onRefresh();
          } finally {
            refreshing.current = false;
            setIsRefreshingUI(false);
            setIsAnimatingBack(true);
            setOffset(0);
            window.setTimeout(() => setIsAnimatingBack(false), 220);
          }
        }, 120);

        return;
      }

      // Not enough pull -> animate back
      setIsAnimatingBack(true);
      setOffset(0);
      window.setTimeout(() => setIsAnimatingBack(false), 220);
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    // NOTE: must be passive:false so we can preventDefault()
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", endPull);
    window.addEventListener("touchcancel", endPull);

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove as any);
      window.removeEventListener("touchend", endPull);
      window.removeEventListener("touchcancel", endPull);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, threshold, maxPull, offset]);

  return {
  offset,
  isAnimatingBack,
  isRefreshingUI,
};
}
