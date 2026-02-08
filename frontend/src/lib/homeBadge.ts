import { fetchTodoRemaining } from "./api";
import { todayYYYYMMDD, addDaysYYYYMMDD } from "./date";

export async function getTodoRemainingCount(params?: {
  days?: number; // default 7
}): Promise<{ remaining: number; from: string; to: string }> {
  const days = Math.max(1, Number(params?.days ?? 7));
  const to = todayYYYYMMDD();
  const from = addDaysYYYYMMDD(to, -(days - 1));

  const r = await fetchTodoRemaining({ from, to });
  return { remaining: r.remaining, from, to };
}
