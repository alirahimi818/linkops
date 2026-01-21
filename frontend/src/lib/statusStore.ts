import { get, set } from "idb-keyval";

export type ItemStatus = "done" | "later" | "hidden";
export type StatusMap = Record<string, ItemStatus>;

const keyForDate = (date: string) => `status:${date}`;

export async function getStatusMap(date: string): Promise<StatusMap> {
  return (await get(keyForDate(date))) ?? {};
}

export async function setItemStatus(date: string, itemId: string, status: ItemStatus) {
  const m = await getStatusMap(date);
  m[itemId] = status;
  await set(keyForDate(date), m);
}

export async function clearItemStatus(date: string, itemId: string) {
  const m = await getStatusMap(date);
  delete m[itemId];
  await set(keyForDate(date), m);
}
