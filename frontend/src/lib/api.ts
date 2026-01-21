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

export type UserRow = {
  id: string;
  username: string;
  email: string | null;
  role: string;
  created_at: string;
};

export async function superadminListUsers(): Promise<UserRow[]> {
  const res = await fetch(`/api/admin/users`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("List users failed");
  const data = await res.json();
  return data.users ?? [];
}

export async function superadminCreateUser(payload: {
  username: string;
  password: string;
  email?: string | null;
  role: string;
}) {
  const res = await fetch(`/api/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Create user failed");
  return res.json();
}

export async function superadminDeleteUser(id: string) {
  const res = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Delete user failed");
  return res.json();
}

