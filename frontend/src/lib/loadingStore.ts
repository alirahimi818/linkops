type Listener = (active: boolean) => void;

let inFlight = 0;
let active = false;

let showTimer: number | null = null;
let minVisibleTimer: number | null = null;

const listeners = new Set<Listener>();

const SHOW_DELAY_MS = 120;      // don't show overlay for very fast requests
const MIN_VISIBLE_MS = 250;     // once shown, keep it at least this long

function emit(next: boolean) {
  active = next;
  for (const l of listeners) l(active);
}

function clearTimer(t: number | null) {
  if (t !== null) window.clearTimeout(t);
}

export function subscribeLoading(fn: Listener) {
  listeners.add(fn);
  fn(active);
  return () => listeners.delete(fn);
}

export function loadingStart() {
  inFlight += 1;

  // If already visible or scheduled, do nothing
  if (active || showTimer !== null) return;

  // Schedule showing (debounce)
  showTimer = window.setTimeout(() => {
    showTimer = null;

    // Only show if still in-flight
    if (inFlight > 0 && !active) {
      emit(true);

      // Start min-visible lock
      clearTimer(minVisibleTimer);
      minVisibleTimer = window.setTimeout(() => {
        minVisibleTimer = null;
        // If no requests by now, hide
        if (inFlight === 0) emit(false);
      }, MIN_VISIBLE_MS);
    }
  }, SHOW_DELAY_MS);
}

export function loadingStop() {
  inFlight = Math.max(0, inFlight - 1);

  // If we haven't shown yet and no requests remain -> cancel showing
  if (inFlight === 0 && showTimer !== null) {
    clearTimer(showTimer);
    showTimer = null;
    return;
  }

  // If overlay is visible:
  if (active) {
    // If min-visible timer is still running, wait for it
    if (minVisibleTimer !== null) return;

    // Otherwise hide immediately when no requests remain
    if (inFlight === 0) emit(false);
  }
}

export function loadingReset() {
  inFlight = 0;
  clearTimer(showTimer);
  clearTimer(minVisibleTimer);
  showTimer = null;
  minVisibleTimer = null;
  if (active) emit(false);
}

export function loadingForceOn() {
  // Cancel timers, force visible
  if (!active) emit(true);
}