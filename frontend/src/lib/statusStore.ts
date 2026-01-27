export type ItemStatus = "done" | "later" | "hidden";
export type StatusMap = Record<string, ItemStatus>;

function keyFor(date: string) {
  return `status:${date}`;
}

export async function getStatusMap(date: string): Promise<StatusMap> {
  try {
    const raw = localStorage.getItem(keyFor(date));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as StatusMap;
  } catch {
    return {};
  }
}

function setStatusMap(date: string, map: StatusMap) {
  localStorage.setItem(keyFor(date), JSON.stringify(map));
}

/**
 * Set status for item. Use `null` to clear status (back to todo).
 */
export async function setItemStatus(date: string, itemId: string, status: ItemStatus | null) {
  const map = await getStatusMap(date);

  if (status === null) {
    delete map[itemId];
  } else {
    map[itemId] = status;
  }

  setStatusMap(date, map);

  // Notify other pages/components (Home badge, etc.)
  window.dispatchEvent(
    new CustomEvent("status:changed", { detail: { date, itemId, status } })
  );
}
