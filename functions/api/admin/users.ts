function getToken(): string {
  return localStorage.getItem("admin:jwt") ?? "";
}

export async function adminFetchItems(date: string) {
  const res = await fetch(`/api/admin/items?date=${encodeURIComponent(date)}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Admin fetch failed");
  const data = await res.json();
  return data.items ?? [];
}

export async function adminCreateItem(payload: any) {
  const res = await fetch(`/api/admin/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Create failed");
  return res.json();
}

export async function adminDeleteItem(id: string) {
  const res = await fetch(`/api/admin/items?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Delete failed");
  return res.json();
}

export async function adminLogin(username: string, password: string) {
  const res = await fetch(`/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Login failed");
  return res.json() as Promise<{ token: string; user: { username: string; email?: string | null; role: string } }>;
}
