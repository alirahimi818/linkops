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
  // Prefer migrating global first (not required, but nice)
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
 * If there are any legacy status keys left, migration should run
 * even if the global flag is already set (self-healing).
 */
export function shouldRunLegacyMigration(): boolean {
  const hasLegacyLeft = remainingLegacyKeysCount() > 0;
  return hasLegacyLeft;
}

async function postStatus(itemId: string, status: LegacyStatus | null): Promise<void> {
  const res = await fetch("/api/status/set", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-Device-Id": getDeviceId(),
    },
    body: JSON.stringify({ item_id: itemId, status }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Migration POST failed (${res.status}): ${txt.slice(0, 200)}`);
  }
}

/**
 * Migrates ALL legacy status keys from localStorage to server.
 * - Sends one request per item_id.
 * - Deletes a localStorage key only when fully migrated.
 * - Sets migration flag only when no legacy keys remain.
 */
export async function migrateLegacyStatusToServer(): Promise<{
  ok: boolean;
  migratedKeys: number;
  migratedItems: number;
  remainingKeys: number;
}> {
  const keys = getAllLegacyKeys();

  let migratedKeys = 0;
  let migratedItems = 0;

  for (const key of keys) {
    const map = readLegacyMap(key);
    const entries = Object.entries(map);

    if (entries.length === 0) continue;

    // Try migrate this key completely.
    // If any item fails, we keep the key (and keep remaining items)
    // so it can retry later.
    const remaining: LegacyMap = {};

    for (const [itemId, st] of entries) {
      if (!itemId) continue;
      if (!isValidStatus(st)) continue;

      try {
        await postStatus(itemId, st);
        migratedItems++;
      } catch {
        // Keep for retry
        remaining[itemId] = st;
      }
    }

    if (Object.keys(remaining).length === 0) {
      // fully migrated => remove this key
      localStorage.removeItem(key);
      migratedKeys++;
    } else {
      // partially migrated => keep remaining
      localStorage.setItem(key, JSON.stringify(remaining));
    }
  }

  const remainingKeys = remainingLegacyKeysCount();

  // Only set global flag when fully clean
  if (remainingKeys === 0) {
    localStorage.setItem(MIGRATION_FLAG_KEY, "1");
  } else {
    // Keep flag unset OR remove it to ensure retries
    // (If it was already set in production, we still self-heal via shouldRunLegacyMigration)
    // You can also choose to keep it set; self-heal logic above ignores it.
  }

  return { ok: remainingKeys === 0, migratedKeys, migratedItems, remainingKeys };
}