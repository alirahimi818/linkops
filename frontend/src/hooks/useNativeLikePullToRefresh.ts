import { useEffect, useRef, useState } from "react";

type Options = {
  enabled?: boolean;
  threshold?: number; // px to trigger refresh
  maxPull?: number;   // max visual pull distance
  resistance?: number; // 0..1 (lower => heavier)
};

export function useNativeLikePullToRefresh(
  onRefresh: () => void | Promise<void>,
  opts?: Options,
) {
  const enabled = opts?.enabled ?? true;
  const threshold = opts?.threshold ?? 90;
  const maxPull = opts?.maxPull ?? 160;
  const resistance = opts?.resistance ?? 0.55;

  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const refreshing = useRef(false);

  const [offset, setOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isRefreshingUI, setIsRefreshingUI] = useState(false);

  const progress = Math.min(offset / threshold, 1);

  function atTop() {
    return window.scrollY <= 0;
  }

  useEffect(() => {
    if (!enabled) return;

    function onTouchStart(e: TouchEvent) {
      if (!atTop()) return;
      if (refreshing.current) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
      setIsAnimating(false);
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

      // Prevent native bounce to feel app-like
      e.preventDefault();

      // Resistance curve (more pull => harder)
      const eased = raw * resistance;
      const extra = Math.max(0, eased - threshold);
      const curved = threshold + extra * 0.35; // harder after threshold
      setOffset(Math.min(maxPull, curved));
    }

    async function endPull() {
      if (!pulling.current) return;
      pulling.current = false;
      startY.current = null;

      const shouldRefresh = offset >= threshold;

      if (shouldRefresh && !refreshing.current) {
        refreshing.current = true;
        setIsRefreshingUI(true);

        // Snap to threshold (like native apps)
        setIsAnimating(true);
        setOffset(threshold);

        // Trigger refresh a tick later so UI snaps first
        window.setTimeout(async () => {
          try {
            await onRefresh();
          } finally {
            // If onRefresh does not hard reload, reset
            refreshing.current = false;
            setIsRefreshingUI(false);
            setIsAnimating(true);
            setOffset(0);
            window.setTimeout(() => setIsAnimating(false), 220);
          }
        }, 120);

        return;
      }

      // Animate back
      setIsAnimating(true);
      setOffset(0);
      window.setTimeout(() => setIsAnimating(false), 220);
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
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
  }, [enabled, threshold, maxPull, resistance, offset]);

  return {
    offset,
    progress,
    isAnimating,
    isRefreshingUI,
  };
}