// frontend/src/lib/homeBadge.ts
import { fetchItems } from "./api";
import { getStatusMap } from "./statusStore";
import { todayYYYYMMDD } from "./date";

export type TodayBadgeResult = {
  date: string;
  total: number;
  doneOrHidden: number;
  remaining: number;
};

export async function getTodayRemainingCount(): Promise<TodayBadgeResult> {
  const date = todayYYYYMMDD();

  const [items, dayMap, globalMap] = await Promise.all([
    fetchItems(date),
    getStatusMap({ kind: "date", date }),
    getStatusMap({ kind: "global" }),
  ]);

  const total = items.length;

  let doneOrHidden = 0;
  for (const it of items as any[]) {
    const isGlobal = it?.is_global === 1 || it?.is_global === true;
    const s = isGlobal ? globalMap[it.id] : dayMap[it.id];
    if (s === "done" || s === "hidden") doneOrHidden++;
  }

  const remaining = Math.max(0, total - doneOrHidden);
  return { date, total, doneOrHidden, remaining };
}
