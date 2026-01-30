type Listener = (active: boolean) => void;

let inFlight = 0;
let active = false;

const listeners = new Set<Listener>();

// Tuning
const SHOW_DELAY_MS = 120;     // don't show overlay for very fast requests
const MIN_VISIBLE_MS = 250;    // once shown, keep visible at least this long
const HIDE_DELAY_MS = 250;     // when inFlight hits 0, wait before hiding (prevents flicker)

let showTimer: number | null = null;
let minVisibleTimer: number | null = null;
let hideTimer: number | null = null;

function emit(next: boolean) {
  active = next;
  for (const l of listeners) l(active);
}

function clear(t: number | null) {
  if (t !== null) window.clearTimeout(t);
}

export function subscribeLoading(fn: Listener): () => void {
  listeners.add(fn);
  fn(active);
  return () => {
    listeners.delete(fn);
  };
}

function scheduleHideIfIdle() {
  // Only hide if currently visible and no min-visible lock and no inflight
  if (!active) return;
  if (inFlight > 0) return;
  if (minVisibleTimer !== null) return;

  clear(hideTimer);
  hideTimer = window.setTimeout(() => {
    hideTimer = null;
    if (inFlight === 0 && minVisibleTimer === null) emit(false);
  }, HIDE_DELAY_MS);
}

export function loadingStart() {
  inFlight += 1;

  // If a hide was pending, cancel it (new work arrived)
  clear(hideTimer);
  hideTimer = null;

  // If already visible, we're done
  if (active) return;

  // If already scheduled to show, keep it
  if (showTimer !== null) return;

  showTimer = window.setTimeout(() => {
    showTimer = null;
    if (inFlight > 0 && !active) {
      emit(true);

      // Start min-visible lock
      clear(minVisibleTimer);
      minVisibleTimer = window.setTimeout(() => {
        minVisibleTimer = null;
        // If nothing in-flight at end of min visible, hide (with cooldown)
        scheduleHideIfIdle();
      }, MIN_VISIBLE_MS);
    }
  }, SHOW_DELAY_MS);
}

export function loadingStop() {
  inFlight = Math.max(0, inFlight - 1);

  // If no requests remain and overlay not shown yet -> cancel scheduled show
  if (inFlight === 0 && !active && showTimer !== null) {
    clear(showTimer);
    showTimer = null;
    return;
  }

  // If visible and we're idle -> hide with cooldown (prevents off/on between chained requests)
  if (inFlight === 0) {
    scheduleHideIfIdle();
  }
}

export function loadingForceOn() {
  // Cancel timers, force visible
  clear(showTimer);
  clear(hideTimer);
  showTimer = null;
  hideTimer = null;

  if (!active) emit(true);

  // keep minVisible lock simple
  clear(minVisibleTimer);
  minVisibleTimer = window.setTimeout(() => {
    minVisibleTimer = null;
    scheduleHideIfIdle();
  }, MIN_VISIBLE_MS);
}

export function loadingReset() {
  inFlight = 0;
  clear(showTimer);
  clear(minVisibleTimer);
  clear(hideTimer);
  showTimer = null;
  minVisibleTimer = null;
  hideTimer = null;
  if (active) emit(false);
}