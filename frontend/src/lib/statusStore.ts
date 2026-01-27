export type ItemStatus = "done" | "later" | "hidden";
export type StatusMap = Record<string, ItemStatus>;

export type StatusScope = { kind: "date"; date: string } | { kind: "global" };

function keyFor(scope: StatusScope) {
  return scope.kind === "global" ? "status:global" : `status:${scope.date}`;
}

export async function getStatusMap(scope: StatusScope): Promise<StatusMap> {
  try {
    const raw = localStorage.getItem(keyFor(scope));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as StatusMap;
  } catch {
    return {};
  }
}

function setStatusMap(scope: StatusScope, map: StatusMap) {
  localStorage.setItem(keyFor(scope), JSON.stringify(map));
}

/**
 * Set status for item. Use `null` to clear status (back to todo).
 */
export async function setItemStatus(scope: StatusScope, itemId: string, status: ItemStatus | null) {
  const map = await getStatusMap(scope);

  if (status === null) {
    delete map[itemId];
  } else {
    map[itemId] = status;
  }

  setStatusMap(scope, map);

  window.dispatchEvent(
    new CustomEvent("status:changed", {
      detail: {
        scope: scope.kind,
        date: scope.kind === "date" ? scope.date : null,
        itemId,
        status,
      },
    })
  );
}