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

  const [items, map] = await Promise.all([fetchItems(date), getStatusMap(date)]);

  const total = items.length;

  let doneOrHidden = 0;
  for (const it of items) {
    const s = map[it.id];
    if (s === "done" || s === "hidden") doneOrHidden++;
  }

  const remaining = Math.max(0, total - doneOrHidden);
  return { date, total, doneOrHidden, remaining };
}
