// frontend/src/lib/deviceSync.ts
const DEVICE_ID_KEY = "device_id_v1";

export function isValidUuid(v: string): boolean {
  // Accept UUID v1-v5 (case-insensitive)
  const re =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return re.test(v.trim());
}

export function getDeviceId(): string | null {
  try {
    return localStorage.getItem(DEVICE_ID_KEY);
  } catch {
    return null;
  }
}

export function getOrCreateDeviceId(): string {
  const existing = getDeviceId();
  if (existing && isValidUuid(existing)) return existing;

  const next =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : fallbackUuidV4();

  try {
    localStorage.setItem(DEVICE_ID_KEY, next);
  } catch {
    // ignore
  }
  return next;
}

export function setDeviceId(deviceId: string): boolean {
  const v = deviceId.trim();
  if (!isValidUuid(v)) return false;
  try {
    localStorage.setItem(DEVICE_ID_KEY, v);
  } catch {
    return false;
  }
  return true;
}

export function rotateDeviceId(): string | null {
  const next =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : fallbackUuidV4();

  try {
    localStorage.setItem(DEVICE_ID_KEY, next);
    return next;
  } catch {
    return null;
  }
}

export function buildSyncUrl(deviceId: string): string {
  const origin = window.location.origin;
  const path = "/"; // Home
  const u = new URL(path, origin);
  u.searchParams.set("device_id", deviceId.trim());
  return u.toString();
}

export function tryApplyDeviceIdFromUrl(): {
  applied: boolean;
  reason?: "missing" | "invalid" | "storage";
} {
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("device_id");
    if (!q) return { applied: false, reason: "missing" };

    const v = q.trim();
    if (!isValidUuid(v)) return { applied: false, reason: "invalid" };

    const ok = setDeviceId(v);
    if (!ok) return { applied: false, reason: "storage" };

    // Notify app (so badges etc can refresh)
    window.dispatchEvent(new Event("status:changed"));

    // Clean URL without reload
    url.searchParams.delete("device_id");
    const next = url.pathname + (url.search ? url.search : "") + url.hash;
    window.history.replaceState({}, "", next);

    return { applied: true };
  } catch {
    return { applied: false, reason: "invalid" };
  }
}

function fallbackUuidV4(): string {
  // RFC4122-ish v4 fallback (not crypto-strong, last resort)
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  let s = "";
  for (let i = 0; i < 32; i++) s += hex();
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(
    17,
    20
  )}-${s.slice(20)}`;
}