export type Item = {
  id: string;
  date: string;
  title: string;
  url: string;
  description: string;
  action_type: string | null;
  created_at: string;
  created_by_email?: string | null;
};

export async function fetchItems(date: string): Promise<Item[]> {
  const res = await fetch(`/api/items?date=${encodeURIComponent(date)}`);
  if (!res.ok) throw new Error("Failed to fetch items");
  const data = await res.json() as { items: Item[] };
  return data.items ?? [];
}

export async function adminFetchItems(date: string): Promise<Item[]> {
  const res = await fetch(`/api/admin/items?date=${encodeURIComponent(date)}`);
  if (!res.ok) throw new Error("Admin fetch failed");
  const data = await res.json() as { items: Item[] };
  return data.items ?? [];
}

export async function adminCreateItem(payload: {
  date: string;
  title: string;
  url: string;
  description: string;
  action_type?: string | null;
}) {
  const res = await fetch(`/api/admin/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Create failed");
  return res.json();
}

export async function adminDeleteItem(id: string) {
  const res = await fetch(`/api/admin/items?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Delete failed");
  return res.json();
}
