// frontend/src/lib/statusMigration.ts

import { setItemStatusRemote } from "./api";
import { addDaysYYYYMMDD, todayYYYYMMDD } from "./date";

type LegacyItemStatus = "done" | "later" | "hidden";
type LegacyStatusMap = Record<string, LegacyItemStatus>;

function safeParseMap(raw: string | null): LegacyStatusMap | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const out: LegacyStatusMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v === "done" || v === "later" || v === "hidden") {
        out[String(k)] = v;
      }
    }
    return out;
  } catch {
    return null;
  }
}

function buildDefaultLastDays(count: number): string[] {
  const to = todayYYYYMMDD();
  const days: string[] = [];
  for (let i = 0; i < count; i++) {
    days.push(addDaysYYYYMMDD(to, -i));
  }
  return days;
}

async function migrateOneMap(map: LegacyStatusMap) {
  const entries = Object.entries(map);
  if (!entries.length) return;

  // Sequential to reduce burst; you can parallelize later if needed
  for (const [itemId, status] of entries) {
    try {
      await setItemStatusRemote(String(itemId), status);
    } catch {
      // ignore individual failures; migration is best-effort
    }
  }
}

/**
 * Migrate legacy localStorage status maps into the server.
 * - If lastDays is omitted, it migrates last 7 days automatically.
 * - After a successful attempt, it removes legacy keys so old method is not kept.
 */
export async function migrateLegacyStatusToServer(lastDays?: string[]) {
  const days = (lastDays && lastDays.length ? lastDays : buildDefaultLastDays(7))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));

  // Global
  const globalKey = "status:global";
  const globalMap = safeParseMap(localStorage.getItem(globalKey));
  if (globalMap) {
    await migrateOneMap(globalMap);
    localStorage.removeItem(globalKey);
  }

  // Per-day
  for (const d of days) {
    const key = `status:${d}`;
    const dayMap = safeParseMap(localStorage.getItem(key));
    if (!dayMap) continue;

    await migrateOneMap(dayMap);
    localStorage.removeItem(key);
  }

  // Optional: you can mark migration done (prevents re-running)
  localStorage.setItem("status:migrated:v1", "1");
}

/**
 * Optional helper to avoid calling migration multiple times.
 */
export function shouldRunLegacyMigration(): boolean {
  return localStorage.getItem("status:migrated:v1") !== "1";
}
