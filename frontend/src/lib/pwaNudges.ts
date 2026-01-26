const VISITS_KEY = "pwa:visits";
const DISMISSED_UNTIL_KEY = "pwa:dismissed_until";

function nowMs() {
  return Date.now();
}

export function bumpVisits(): number {
  try {
    const v = Number(localStorage.getItem(VISITS_KEY) ?? "0") + 1;
    localStorage.setItem(VISITS_KEY, String(v));
    return v;
  } catch {
    return 1;
  }
}

export function getVisits(): number {
  try {
    return Number(localStorage.getItem(VISITS_KEY) ?? "0") || 0;
  } catch {
    return 0;
  }
}

export function dismissForDays(days: number) {
  try {
    const until = nowMs() + days * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISSED_UNTIL_KEY, String(until));
  } catch {
    // ignore
  }
}

export function isDismissedByTime(): boolean {
  try {
    const until = Number(localStorage.getItem(DISMISSED_UNTIL_KEY) ?? "0") || 0;
    return until > nowMs();
  } catch {
    return false;
  }
}
