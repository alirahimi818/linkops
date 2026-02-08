// frontend/src/lib/statusMigration.ts
import { getDeviceId } from "./device";

type LegacyStatus = "later" | "done" | "hidden";
type LegacyMap = Record<string, LegacyStatus>;

const MIGRATION_FLAG_KEY = "status:migrated:v1";

function isDateKey(k: string): boolean {
  return /^status:\d{4}-\d{2}-\d{2}$/.test(k);
}

function isValidStatus(v: any): v is LegacyStatus {
  return v === "later" || v === "done" || v === "hidden";
}

function getAllLegacyKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k === "status:global" || isDateKey(k)) keys.push(k);
  }

  // Prefer migrating global first
  keys.sort((a, b) => {
    if (a === "status:global") return -1;
    if (b === "status:global") return 1;
    return a.localeCompare(b);
  });

  return keys;
}

function readLegacyMap(key: string): LegacyMap {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as LegacyMap;
  } catch {
    return {};
  }
}

function remainingLegacyKeysCount(): number {
  return getAllLegacyKeys().filter((k) => {
    const m = readLegacyMap(k);
    return Object.keys(m).length > 0;
  }).length;
}

/**
 * If there are any legacy status keys left, migration should run.
 * (Self-healing even if a flag was set previously)
 */
export function shouldRunLegacyMigration(): boolean {
  return remainingLegacyKeysCount() > 0;
}

type PostStatusResult =
  | { ok: true }
  | { ok: false; retryable: boolean; reason: string };

async function postStatus(
  itemId: string,
  status: LegacyStatus | null,
): Promise<PostStatusResult> {
  let res: Response;

  try {
    res = await fetch("/api/status/set", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Device-Id": getDeviceId(),
      },
      body: JSON.stringify({ item_id: itemId, status }),
    });
  } catch (e: any) {
    // Network error => retryable
    return { ok: false, retryable: true, reason: String(e?.message ?? e) };
  }

  if (res.ok) return { ok: true };

  // Important: handle permanent vs retryable failures
  // - 404: item no longer exists => permanent, drop it from legacy
  // - 400: invalid payload => permanent (shouldn't happen, but don't retry forever)
  // - 401/403: auth/device issues => retryable? depends, but better keep so you notice
  // - 429/5xx: retryable
  const statusCode = res.status;
  const txt = await res.text().catch(() => "");

  if (statusCode === 404) {
    return { ok: false, retryable: false, reason: `404: ${txt.slice(0, 120)}` };
  }

  if (statusCode === 400) {
    return { ok: false, retryable: false, reason: `400: ${txt.slice(0, 120)}` };
  }

  if (statusCode === 422) {
    return { ok: false, retryable: false, reason: `422: ${txt.slice(0, 120)}` };
  }

  if (statusCode === 429) {
    return { ok: false, retryable: true, reason: `429: ${txt.slice(0, 120)}` };
  }

  if (statusCode >= 500) {
    return { ok: false, retryable: true, reason: `${statusCode}: ${txt.slice(0, 120)}` };
  }

  // default: treat as retryable so we don't lose data silently
  return { ok: false, retryable: true, reason: `${statusCode}: ${txt.slice(0, 120)}` };
}

export async function migrateLegacyStatusToServer(): Promise<{
  ok: boolean;
  migratedKeys: number;
  migratedItems: number;
  droppedItems: number; // items removed due to permanent errors (e.g. 404)
  remainingKeys: number;
}> {
  const keys = getAllLegacyKeys();

  let migratedKeys = 0;
  let migratedItems = 0;
  let droppedItems = 0;

  for (const key of keys) {
    const map = readLegacyMap(key);
    const entries = Object.entries(map);

    if (entries.length === 0) continue;

    const remaining: LegacyMap = {};

    for (const [itemId, st] of entries) {
      if (!itemId) continue;
      if (!isValidStatus(st)) continue;

      const r = await postStatus(itemId, st);

      if (r.ok) {
        migratedItems++;
        continue;
      }

      if (r.retryable) {
        // Keep for retry later
        remaining[itemId] = st;
      } else {
        // Permanent failure (e.g., 404). Drop it so migration can finish.
        droppedItems++;
      }
    }

    if (Object.keys(remaining).length === 0) {
      localStorage.removeItem(key);
      migratedKeys++;
    } else {
      localStorage.setItem(key, JSON.stringify(remaining));
    }
  }

  const remainingKeys = remainingLegacyKeysCount();

  if (remainingKeys === 0) {
    localStorage.setItem(MIGRATION_FLAG_KEY, "1");
  }

  return {
    ok: remainingKeys === 0,
    migratedKeys,
    migratedItems,
    droppedItems,
    remainingKeys,
  };
}
