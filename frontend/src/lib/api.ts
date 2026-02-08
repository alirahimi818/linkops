// frontend/src/lib/api.ts

import { getDeviceId } from "./device";
import { loadingStart, loadingStop } from "./loadingStore";

/* =========================
   AI Types
   ========================= */

export type Tone =
  | "angry"        // خشم، اعتراض، فریاد
  | "outraged"     // شوکه، خشم اخلاقی، افشا
  | "demanding"    // مطالبه‌گر، فشار مستقیم
  | "urgent"       // فوری، هشداردهنده
  | "sad"          // سوگ، اندوه، داغ
  | "hopeful"      // امید محتاطانه
  | "defiant"      // سرسخت، نافرمان
  | "sarcastic"    // طعنه‌دار، کنایه
  | "calm_firm"    // آرام ولی محکم
  | "neutral";     // خنثی، بی‌طرف

export type AdminAIGenerateExample = {
  text: string; // English example
};

export type AdminAIGenerateCommentsPayload = {
  item_id: string;

  title_fa: string;
  description_fa: string;
  need_fa: string;
  comment_type_fa: string;

  tone: Tone;

  // Optional: admin can provide examples
  examples?: AdminAIGenerateExample[];

  // Optional: save generated comments into DB
  save?: boolean;

  // Optional: allow overriding count (backend clamps it anyway)
  count?: number;
};

export type AIGeneratedComment = {
  text: string;
  translation_text: string; // Persian, may be empty string
};

export type AdminAIGenerateCommentsResponse = {
  ok: boolean;
  job_id: string;
  saved_comment_ids: string[];
  comments: AIGeneratedComment[];
};

/**
 * Notes:
 * - Public endpoints do NOT use auth token.
 * - Admin/SuperAdmin endpoints use Bearer token stored in localStorage("admin:jwt").
 * - This file is a client wrapper only; it does not implement server logic.
 */

export type Action = {
  id: string;
  name: string; // machine name
  label: string; // UI label
  created_at: string;
};

export type CommentInput = {
  text: string;
  translation_text?: string | null;
};

export type ItemComment = {
  id: string;
  item_id: string;
  text: string;
  translation_text?: string | null;

  author_type?: string | null;
  author_id?: string | null;

  created_at: string;
};

export type Item = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  url: string;
  description: string;

  category_id?: string | null;
  category_name?: string | null;
  category_image?: string | null;

  actions?: Action[];

  // IMPORTANT: admin/items returns full comments array (not just count)
  comments?: ItemComment[];

  comments_count?: number;

  is_global?: number;

  created_at: string;
  created_by_email?: string | null;
  created_by_username?: string | null;
};

export type Category = {
  id: string;
  name: string;
  image?: string | null;
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
  name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
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
  name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
};

export type Me = {
  id: string;
  username: string;
  role: string;
  email: string | null;
  name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
};

export type AdminCreateItemPayload = {
  date: string; // YYYY-MM-DD
  title: string;
  url: string;
  description: string;

  is_global?: boolean;

  category_id: string | null;
  action_ids: string[];

  comments: Array<string | CommentInput>;
};

export type AdminUpdateItemPayload = Partial<
  Omit<AdminCreateItemPayload, "date">
> & {
  date?: string;
};

function getToken(): string {
  return localStorage.getItem("admin:jwt") ?? "";
}

async function requestJSON<T>(
  input: string,
  init?: RequestInit,
  opts?: { auth?: boolean },
): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  headers.set("X-Device-Id", getDeviceId());
  headers.set("Accept", "application/json");

  const useAuth = opts?.auth ?? false;
  if (useAuth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  loadingStart();
  try {
    const res = await fetch(input, { ...init, headers });

    const text = await res.text();

    let data: any = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      const msg =
        (data && (data.error || data.message)) ||
        (text
          ? `Request failed (${res.status}): ${text.slice(0, 200)}`
          : `Request failed (${res.status})`);

      const err: any = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data as T;
  } finally {
    loadingStop();
  }
}

/* =========================
   Public (no login)
   ========================= */

export async function fetchItems(
  date: string,
  itemId?: string,
): Promise<Item[]> {
  const qs = new URLSearchParams({ date });
  if (itemId) qs.set("item_id", itemId);

  const data = await requestJSON<{ items: Item[] }>(
    `/api/items?${qs.toString()}`,
    undefined,
    { auth: false },
  );
  return data.items ?? [];
}

/**
 * Public: get comments for a given item (for the user-facing UI when needed)
 * Expected endpoint: GET /api/items/comments?item_id=...
 */
export async function fetchItemComments(
  itemId: string,
): Promise<ItemComment[]> {
  const data = await requestJSON<{ comments: ItemComment[] }>(
    `/api/items/comments?item_id=${encodeURIComponent(itemId)}`,
    undefined,
    { auth: false },
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
    { auth: false },
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
    { auth: false },
  );
  return data.categories ?? [];
}

/**
 * Public: list actions (read-only)
 * Expected endpoint: GET /api/actions
 */
export async function fetchActions(): Promise<Action[]> {
  const data = await requestJSON<{ actions: Action[] }>(
    `/api/actions`,
    undefined,
    { auth: false },
  );
  return data.actions ?? [];
}

/* =========================
   Admin auth
   ========================= */

export async function adminLogin(
  username: string,
  password: string,
): Promise<AdminLoginResponse> {
  return requestJSON<AdminLoginResponse>(
    `/api/admin/login`,
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
    { auth: false },
  );
}

export async function adminMe(): Promise<Me> {
  const data = await requestJSON<{ user: Me }>(`/api/admin/me`, undefined, {
    auth: true,
  });
  return data.user;
}

export async function adminUpdateMe(payload: {
  email?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  password?: string; // optional: if empty, do not send or backend ignores blank
}) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/me`,
    { method: "PATCH", body: JSON.stringify(payload) },
    { auth: true },
  );
}

/* =========================
   Admin Items (v2)
   ========================= */

export async function adminFetchItems(date: string): Promise<Item[]> {
  const data = await requestJSON<{ items: Item[] }>(
    `/api/admin/items?date=${encodeURIComponent(date)}`,
    undefined,
    { auth: true },
  );
  return data.items ?? [];
}

export async function adminCreateItem(payload: AdminCreateItemPayload) {
  return requestJSON<{ ok: boolean; id: string }>(
    `/api/admin/items`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true },
  );
}

/**
 * Optional (recommended): update item
 * Expected endpoint: PUT /api/admin/items?id=...
 */
export async function adminUpdateItem(
  id: string,
  payload: AdminUpdateItemPayload,
) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/items?id=${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    { auth: true },
  );
}

export async function adminDeleteItem(id: string) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/items?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
    { auth: true },
  );
}

/**
 * Admin: list comments for an item (manage/edit)
 * Expected endpoint: GET /api/admin/item-comments?item_id=...
 */
export async function adminFetchItemComments(
  itemId: string,
): Promise<ItemComment[]> {
  const data = await requestJSON<{ comments: ItemComment[] }>(
    `/api/admin/item-comments?item_id=${encodeURIComponent(itemId)}`,
    undefined,
    { auth: true },
  );
  return data.comments ?? [];
}

/**
 * Admin: add bulk comments for an item (bulk up to 20)
 * Expected endpoint: POST /api/admin/item-comments?item_id=...
 */
export async function adminBulkSaveItemComments(
  itemId: string,
  comments: Array<string | CommentInput>,
) {
  return requestJSON<{ ok: boolean; saved_comment_ids?: string[]  }>(
    `/api/admin/item-comments?item_id=${encodeURIComponent(itemId)}`,
    {
      method: "POST",
      body: JSON.stringify({ comments }),
    },
    { auth: true },
  );
}

/**
 * Admin: replace comments for an item (bulk up to 20)
 * Expected endpoint: PUT /api/admin/item-comments?item_id=...
 */
export async function adminReplaceItemComments(
  itemId: string,
  comments: Array<string | CommentInput>,
) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/item-comments?item_id=${encodeURIComponent(itemId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ comments }),
    },
    { auth: true },
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
    { auth: true },
  );
  return data.categories ?? [];
}

/**
 * Admin: create category
 * Expected endpoint: POST /api/admin/categories
 */
export async function adminCreateCategory(name: string, image?: string | null) {
  return requestJSON<{ ok: boolean; id: string }>(
    `/api/admin/categories`,
    {
      method: "POST",
      body: JSON.stringify({ name, image }),
    },
    { auth: true },
  );
}

/**
 * Admin: update category
 * Expected endpoint: PUT /api/admin/categories?id=...
 */
export async function adminUpdateCategory(
  id: string,
  payload: { name: string; image?: string | null },
) {
  const res = await fetch(
    `/api/admin/categories?id=${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(payload),
    },
  );
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
    { auth: true },
  );
}

/* =========================
   SuperAdmin Users
   ========================= */

export async function superadminListUsers(): Promise<UserRow[]> {
  const data = await requestJSON<{ users: UserRow[] }>(
    `/api/admin/users`,
    undefined,
    { auth: true },
  );
  return data.users ?? [];
}

export async function superadminCreateUser(payload: {
  username: string;
  password: string;
  email?: string | null;
  role: string;
  name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
}) {
  return requestJSON<{ ok: boolean; id: string }>(
    `/api/admin/users`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true },
  );
}

export async function superadminUpdateUser(
  id: string,
  payload: {
    username?: string;
    password?: string;
    email?: string | null;
    role?: string;
    name?: string | null;
    avatar_url?: string | null;
    bio?: string | null;
  },
) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/users?id=${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    { auth: true },
  );
}

export async function superadminDeleteUser(id: string) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/users?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
    { auth: true },
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
    { auth: true },
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
    { auth: true },
  );
}

/**
 * SuperAdmin: update hashtag (priority/active)
 * Expected endpoint: PUT /api/admin/hashtags?id=...
 */
export async function superadminUpdateHashtag(
  id: string,
  payload: {
    priority?: number;
    is_active?: number;
    tag?: string;
  },
) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/hashtags?id=${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    { auth: true },
  );
}

/**
 * SuperAdmin: delete hashtag
 * Expected endpoint: DELETE /api/admin/hashtags
 */
export async function superadminDeleteHashtag(id: string) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/hashtags?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
    { auth: true },
  );
}

/**
 * SuperAdmin: list actions
 * Expected endpoint: GET /api/admin/actions
 */
export async function superadminListActions(): Promise<Action[]> {
  const data = await requestJSON<{ actions: Action[] }>(
    `/api/admin/actions`,
    undefined,
    { auth: true },
  );
  return data.actions ?? [];
}

/**
 * SuperAdmin: create action
 * Expected endpoint: POST /api/admin/actions
 */
export async function superadminCreateAction(payload: {
  name: string;
  label: string;
}) {
  return requestJSON<{ ok: boolean; id: string }>(
    `/api/admin/actions`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true },
  );
}

/**
 * SuperAdmin: update action
 * Expected endpoint: PUT /api/admin/actions?id=...
 */
export async function superadminUpdateAction(
  id: string,
  payload: { name?: string; label?: string },
) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/actions?id=${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    { auth: true },
  );
}

/**
 * SuperAdmin: delete action
 * Expected endpoint: DELETE /api/admin/actions?id=...
 */
export async function superadminDeleteAction(id: string) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/actions?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
    { auth: true },
  );
}

/* =========================
   SuperAdmin: Global Hashtag Validator (optional)
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
    { auth: true },
  );
}

/* =========================
   Admin AI
   ========================= */

/**
 * Admin: generate 10 AI comments + Persian translations and save to item_comments
 * Expected endpoint: POST /api/admin/ai/generate-comments
 */
export async function adminGenerateAIComments(
  payload: AdminAIGenerateCommentsPayload,
): Promise<AdminAIGenerateCommentsResponse> {
  return requestJSON<AdminAIGenerateCommentsResponse>(
    `/api/admin/ai/generate-comments`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true },
  );
}
