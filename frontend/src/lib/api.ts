// frontend/src/lib/api.ts

/**
 * Notes:
 * - Public endpoints do NOT use auth token.
 * - Admin/SuperAdmin endpoints use Bearer token stored in localStorage("admin:jwt").
 * - This file is a client wrapper only; it does not implement server logic.
 */

export type Item = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  url: string;
  description: string;

  // Legacy (keep optional for backward compatibility)
  action_type?: string | null;

  // New fields (v2)
  category_id?: string | null;
  category_name?: string | null;
  actions?: string[]; // e.g. ["like","comment"]
  comments_count?: number;

  created_at: string;
  created_by_email?: string | null;
  created_by_username?: string | null;
};

export type Category = {
  id: string;
  name: string;
  created_at?: string;
};

export type HashtagWhitelistRow = {
  id: string;
  tag: string; // stored without '#'
  priority: number;
  is_active: number; // 0/1
  created_at: string;
};

export type AdminUser = {
  id: string;
  username: string;
  email?: string | null;
  role: string;
};

export type AdminLoginResponse = {
  token: string;
  user: AdminUser;
};

export type UserRow = {
  id: string;
  username: string;
  email: string | null;
  role: string;
  created_at: string;
};

export type Me = {
  id: string;
  username: string;
  role: string;
  email: string | null;
};

export type ItemComment = {
  id: string;
  item_id: string;
  text: string;
  created_at: string;
};

export type AdminCreateItemPayload = {
  date: string; // YYYY-MM-DD
  title: string;
  url: string;
  description: string;

  // New fields
  category_id: string | null;
  actions: string[];
  comments: string[]; // up to 20
};

export type AdminUpdateItemPayload = Partial<Omit<AdminCreateItemPayload, "date">> & {
  // Optionally allow moving items between dates if you want; keep disabled by default
  date?: string;
};

function getToken(): string {
  return localStorage.getItem("admin:jwt") ?? "";
}

async function requestJSON<T>(
  input: string,
  init?: RequestInit,
  opts?: { auth?: boolean }
): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  headers.set("Accept", "application/json");

  const useAuth = opts?.auth ?? false;
  if (useAuth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  // If sending body, enforce JSON content-type unless caller set it
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(input, { ...init, headers });

  // Try to read JSON, even on errors (to get server error message)
  const text = await res.text();
  const data = text ? (JSON.parse(text) as any) : null;

  if (!res.ok) {
    const msg =
      (data && (data.error || data.message)) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data as T;
}

/* =========================
   Public (no login)
   ========================= */

export async function fetchItems(date: string): Promise<Item[]> {
  const data = await requestJSON<{ items: Item[] }>(
    `/api/items?date=${encodeURIComponent(date)}`,
    undefined,
    { auth: false }
  );
  return data.items ?? [];
}

/**
 * Public: get comments for a given item (for the user-facing UI when needed)
 * Expected endpoint: GET /api/items/comments?item_id=...
 */
export async function fetchItemComments(itemId: string): Promise<ItemComment[]> {
  const data = await requestJSON<{ comments: ItemComment[] }>(
    `/api/items/comments?item_id=${encodeURIComponent(itemId)}`,
    undefined,
    { auth: false }
  );
  return data.comments ?? [];
}

/**
 * Public: get hashtag whitelist (read-only)
 * Expected endpoint: GET /api/hashtags
 */
export async function fetchHashtagWhitelist(): Promise<HashtagWhitelistRow[]> {
  const data = await requestJSON<{ hashtags: HashtagWhitelistRow[] }>(
    `/api/hashtags`,
    undefined,
    { auth: false }
  );
  return data.hashtags ?? [];
}

/**
 * Public: get active hashtags sorted by priority (lightweight endpoint)
 * Expected endpoint: GET /api/hashtags/active
 */
export async function fetchActiveHashtags(): Promise<
  Array<Pick<HashtagWhitelistRow, "tag" | "priority">>
> {
  const data = await requestJSON<{ hashtags: Array<{ tag: string; priority: number }> }>(
    `/api/hashtags/active`,
    undefined,
    { auth: false }
  );
  return data.hashtags ?? [];
}

/**
 * Public: list categories (read-only)
 * Expected endpoint: GET /api/categories
 */
export async function fetchCategories(): Promise<Category[]> {
  const data = await requestJSON<{ categories: Category[] }>(
    `/api/categories`,
    undefined,
    { auth: false }
  );
  return data.categories ?? [];
}

/* =========================
   Admin auth
   ========================= */

export async function adminLogin(username: string, password: string): Promise<AdminLoginResponse> {
  return requestJSON<AdminLoginResponse>(
    `/api/admin/login`,
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
    { auth: false }
  );
}

export async function adminMe(): Promise<Me> {
  const data = await requestJSON<{ user: Me }>(`/api/admin/me`, undefined, { auth: true });
  return data.user;
}

/* =========================
   Admin Items (v2)
   ========================= */

export async function adminFetchItems(date: string): Promise<Item[]> {
  const data = await requestJSON<{ items: Item[] }>(
    `/api/admin/items?date=${encodeURIComponent(date)}`,
    undefined,
    { auth: true }
  );
  return data.items ?? [];
}

export async function adminCreateItem(payload: AdminCreateItemPayload) {
  // v2 payload (category_id, actions[], comments[])
  return requestJSON<{ ok: boolean; id: string }>(
    `/api/admin/items`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true }
  );
}

/**
 * Optional (recommended): update item
 * Expected endpoint: PUT /api/admin/items?id=...
 */
export async function adminUpdateItem(id: string, payload: AdminUpdateItemPayload) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/items?id=${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    { auth: true }
  );
}

export async function adminDeleteItem(id: string) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/items?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
    { auth: true }
  );
}

/**
 * Admin: list comments for an item (manage/edit)
 * Expected endpoint: GET /api/admin/item-comments?item_id=...
 */
export async function adminFetchItemComments(itemId: string): Promise<ItemComment[]> {
  const data = await requestJSON<{ comments: ItemComment[] }>(
    `/api/admin/item-comments?item_id=${encodeURIComponent(itemId)}`,
    undefined,
    { auth: true }
  );
  return data.comments ?? [];
}

/**
 * Admin: replace comments for an item (bulk up to 20)
 * Expected endpoint: PUT /api/admin/item-comments?item_id=...
 */
export async function adminReplaceItemComments(itemId: string, comments: string[]) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/item-comments?item_id=${encodeURIComponent(itemId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ comments }),
    },
    { auth: true }
  );
}

/* =========================
   Admin Categories
   ========================= */

/**
 * Admin: list categories
 * Expected endpoint: GET /api/admin/categories
 */
export async function adminFetchCategories(): Promise<Category[]> {
  const data = await requestJSON<{ categories: Category[] }>(
    `/api/admin/categories`,
    undefined,
    { auth: true }
  );
  return data.categories ?? [];
}

/**
 * Admin: create category
 * Expected endpoint: POST /api/admin/categories
 */
export async function adminCreateCategory(name: string) {
  return requestJSON<{ ok: boolean; id: string }>(
    `/api/admin/categories`,
    {
      method: "POST",
      body: JSON.stringify({ name }),
    },
    { auth: true }
  );
}

/**
 * Admin: update category
 * Expected endpoint: PUT /api/admin/categories?id=...
 */
export async function adminUpdateCategory(id: string, payload: { name: string }) {
  const res = await fetch(`/api/admin/categories?id=${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Update category failed");
  return res.json();
}


/**
 * Admin: delete category
 * Expected endpoint: DELETE /api/admin/categories?id=...
 */
export async function adminDeleteCategory(id: string) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/categories?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
    { auth: true }
  );
}

/* =========================
   SuperAdmin Users (existing)
   ========================= */

export async function superadminListUsers(): Promise<UserRow[]> {
  const data = await requestJSON<{ users: UserRow[] }>(`/api/admin/users`, undefined, { auth: true });
  return data.users ?? [];
}

export async function superadminCreateUser(payload: {
  username: string;
  password: string;
  email?: string | null;
  role: string;
}) {
  return requestJSON<{ ok: boolean; id: string }>(
    `/api/admin/users`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true }
  );
}

export async function superadminDeleteUser(id: string) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/users?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
    { auth: true }
  );
}

/* =========================
   SuperAdmin Hashtag Whitelist
   Pages to build:
   - SuperAdmin: manage hashtags (CRUD + priority + active)
   ========================= */

/**
 * SuperAdmin: list hashtags
 * Expected endpoint: GET /api/admin/hashtags
 */
export async function superadminListHashtags(): Promise<HashtagWhitelistRow[]> {
  const data = await requestJSON<{ hashtags: HashtagWhitelistRow[] }>(
    `/api/admin/hashtags`,
    undefined,
    { auth: true }
  );
  return data.hashtags ?? [];
}

/**
 * SuperAdmin: create hashtag
 * Expected endpoint: POST /api/admin/hashtags
 */
export async function superadminCreateHashtag(payload: {
  tag: string; // can accept with or without '#'
  priority?: number;
  is_active?: number;
}) {
  return requestJSON<{ ok: boolean; id: string }>(
    `/api/admin/hashtags`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true }
  );
}

/**
 * SuperAdmin: update hashtag (priority/active)
 * Expected endpoint: PUT /api/admin/hashtags?id=...
 */
export async function superadminUpdateHashtag(id: string, payload: {
  priority?: number;
  is_active?: number;
  tag?: string;
}) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/hashtags?id=${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    { auth: true }
  );
}

/**
 * SuperAdmin: delete hashtag
 * Expected endpoint: DELETE /api/admin/hashtags?id=...
 */
export async function superadminDeleteHashtag(id: string) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/hashtags?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
    { auth: true }
  );
}

/* =========================
   SuperAdmin: Global Hashtag Validator (optional)
   If you want server-side validation or suggestions
   Page to build:
   - SuperAdmin / Tools: validate text against whitelist
   ========================= */

/**
 * Admin/SuperAdmin: validate hashtags in text on server (optional)
 * Expected endpoint: POST /api/admin/hashtag-validate
 * Returns issues + suggested replacements
 */
export async function adminValidateHashtags(text: string) {
  return requestJSON<{
    ok: boolean;
    issues: Array<{
      raw: string;
      normalized: string;
      suggestion: string | null;
      reason: string;
    }>;
  }>(
    `/api/admin/hashtag-validate`,
    {
      method: "POST",
      body: JSON.stringify({ text }),
    },
    { auth: true }
  );
}
