// frontend/src/lib/api.ts

import { getDeviceId } from "./device";
import { loadingStart, loadingStop } from "./loadingStore";

/* =========================
   AI Types
   ========================= */

export type Tone =
  | "angry"
  | "outraged"
  | "demanding"
  | "urgent"
  | "sad"
  | "hopeful"
  | "defiant"
  | "sarcastic"
  | "calm_firm"
  | "neutral";

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

  examples?: AdminAIGenerateExample[];
  save?: boolean;
  count?: number;
};

export type AIGeneratedComment = {
  text: string;
  translation_text: string;
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
  name: string;
  label: string;
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

export type ItemUserStatus = "todo" | "later" | "done" | "hidden";
export type ItemSettableStatus = "later" | "done" | "hidden";

export type Item = {
  id: string;

  // returned by feed/items endpoints after you joined device status
  user_status?: ItemUserStatus;

  date: string; // YYYY-MM-DD
  title: string;
  url: string;
  description: string;

  category_id?: string | null;
  category_name?: string | null;
  category_image?: string | null;

  actions?: Action[];
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
  tag: string;
  priority: number;
  is_active: number;
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
  date: string;
  title: string;
  url: string;
  description: string;

  is_global?: boolean;

  category_id: string | null;
  action_ids: string[];

  comments: Array<string | CommentInput>;
};

export type AdminUpdateItemPayload = Partial<Omit<AdminCreateItemPayload, "date">> & {
  date?: string;
};

export type ItemsSummaryTabCounts = {
  todo: number;
  later: number;
  done: number;
  hidden: number;
};

export type ItemsSummaryCategory = {
  id: string; // "all" | "__other__" | category_id
  name: string;
  image: string | null;
  count: number;
  isAll?: boolean;
};

export type ItemsSummaryResponse = {
  range: { from: string; to: string };
  tabs: ItemsSummaryTabCounts;
  categories: ItemsSummaryCategory[];
};

export type FeedTab = "todo" | "later" | "done" | "hidden";

export type ItemsFeedResponse = {
  items: Item[]; // includes actions + comments + user_status
  counts: ItemsSummaryTabCounts;
  next_cursor: string | null;
};

export type SetStatusResponse = {
  ok: boolean;
  status: ItemUserStatus;
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
  headers.set("Accept", "application/json");

  // Attach device id if available
  const deviceId = getDeviceId();
  if (deviceId) headers.set("X-Device-Id", deviceId);

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

export async function fetchItems(date: string, itemId?: string): Promise<Item[]> {
  const qs = new URLSearchParams({ date });
  if (itemId) qs.set("item_id", itemId);

  const data = await requestJSON<{ items: Item[] }>(
    `/api/items?${qs.toString()}`,
    undefined,
    { auth: false },
  );

  return data.items ?? [];
}

export async function fetchItemComments(itemId: string): Promise<ItemComment[]> {
  const data = await requestJSON<{ comments: ItemComment[] }>(
    `/api/items/comments?item_id=${encodeURIComponent(itemId)}`,
    undefined,
    { auth: false },
  );
  return data.comments ?? [];
}

export async function fetchHashtagWhitelist(): Promise<HashtagWhitelistRow[]> {
  const data = await requestJSON<{ hashtags: HashtagWhitelistRow[] }>(
    `/api/hashtags`,
    undefined,
    { auth: false },
  );
  return data.hashtags ?? [];
}

export async function fetchCategories(): Promise<Category[]> {
  const data = await requestJSON<{ categories: Category[] }>(
    `/api/categories`,
    undefined,
    { auth: false },
  );
  return data.categories ?? [];
}

export async function fetchActions(): Promise<Action[]> {
  const data = await requestJSON<{ actions: Action[] }>(
    `/api/actions`,
    undefined,
    { auth: false },
  );
  return data.actions ?? [];
}

export async function setItemStatusRemote(
  itemId: string,
  status: ItemSettableStatus | null,
): Promise<SetStatusResponse> {
  return requestJSON<SetStatusResponse>(
    `/api/status/set`,
    {
      method: "POST",
      body: JSON.stringify({ item_id: itemId, status }),
    },
    { auth: false },
  );
}

export async function fetchItemsSummary(from: string, to: string): Promise<ItemsSummaryResponse> {
  const qs = new URLSearchParams({ from, to });

  return requestJSON<ItemsSummaryResponse>(
    `/api/items/summary?${qs.toString()}`,
    undefined,
    { auth: false },
  );
}

export async function fetchItemsFeed(params: {
  from: string;
  to: string;
  tab: FeedTab;
  cat?: string; // "all" | "__other__" | categoryId (optional)
  limit?: number;
  cursor?: string | null;
}): Promise<ItemsFeedResponse> {
  const qs = new URLSearchParams({
    from: params.from,
    to: params.to,
    tab: params.tab,
    limit: String(params.limit ?? 10),
  });

  // IMPORTANT: If cat is NOT provided, do not send it (means no category filter)
  if (params.cat != null && String(params.cat).trim() !== "") {
    qs.set("cat", params.cat);
  }

  if (params.cursor) qs.set("cursor", params.cursor);

  return requestJSON<ItemsFeedResponse>(
    `/api/items/feed?${qs.toString()}`,
    undefined,
    { auth: false },
  );
}

export async function fetchTodoRemaining(params: {
  from: string;
  to: string;
}): Promise<{ remaining: number }> {
  const sum = await fetchItemsSummary(params.from, params.to);
  return { remaining: sum?.tabs?.todo ?? 0 };
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
  password?: string;
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

export async function adminUpdateItem(id: string, payload: AdminUpdateItemPayload) {
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

export async function adminFetchItemComments(itemId: string): Promise<ItemComment[]> {
  const data = await requestJSON<{ comments: ItemComment[] }>(
    `/api/admin/item-comments?item_id=${encodeURIComponent(itemId)}`,
    undefined,
    { auth: true },
  );
  return data.comments ?? [];
}

export async function adminBulkSaveItemComments(
  itemId: string,
  comments: Array<string | CommentInput>,
) {
  return requestJSON<{ ok: boolean; saved_comment_ids?: string[] }>(
    `/api/admin/item-comments?item_id=${encodeURIComponent(itemId)}`,
    {
      method: "POST",
      body: JSON.stringify({ comments }),
    },
    { auth: true },
  );
}

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

export async function adminFetchCategories(): Promise<Category[]> {
  const data = await requestJSON<{ categories: Category[] }>(
    `/api/admin/categories`,
    undefined,
    { auth: true },
  );
  return data.categories ?? [];
}

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

export async function adminUpdateCategory(
  id: string,
  payload: { name: string; image?: string | null },
) {
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
   ========================= */

export async function superadminListHashtags(): Promise<HashtagWhitelistRow[]> {
  const data = await requestJSON<{ hashtags: HashtagWhitelistRow[] }>(
    `/api/admin/hashtags`,
    undefined,
    { auth: true },
  );
  return data.hashtags ?? [];
}

export async function superadminCreateHashtag(payload: {
  tag: string;
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

export async function superadminDeleteHashtag(id: string) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/hashtags?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
    { auth: true },
  );
}

/* =========================
   SuperAdmin Actions
   ========================= */

export async function superadminListActions(): Promise<Action[]> {
  const data = await requestJSON<{ actions: Action[] }>(
    `/api/admin/actions`,
    undefined,
    { auth: true },
  );
  return data.actions ?? [];
}

export async function superadminCreateAction(payload: { name: string; label: string }) {
  return requestJSON<{ ok: boolean; id: string }>(
    `/api/admin/actions`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true },
  );
}

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

export async function superadminDeleteAction(id: string) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/actions?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
    { auth: true },
  );
}

/* =========================
   Admin/SuperAdmin: Hashtag validate (optional)
   ========================= */

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
   Suggestions (Public + Admin)
   ========================= */

export type SuggestionStatus = "pending" | "approved" | "rejected" | "deleted";

export type ItemSuggestion = {
  id: string;

  title: string | null;
  url: string;
  url_norm?: string; // optional (server may return it)
  description: string | null;

  device_id: string | null;

  status: SuggestionStatus;

  created_at: string;

  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
  review_note: string | null;

  approved_item_id: string | null;
};

export type CreateSuggestionPayload = {
  url: string;
  title?: string;
  description?: string;
};

export async function createSuggestion(payload: CreateSuggestionPayload) {
  return requestJSON<{ ok: boolean; id: string }>(
    `/api/suggestions`,
    {
      method: "POST",
      body: JSON.stringify({
        url: String(payload?.url ?? ""),
        title: payload?.title ?? null,
        description: payload?.description ?? null,
      }),
    },
    { auth: false },
  );
}

/* =========================
   Admin Suggestions
   ========================= */

export async function adminSuggestionsCount(params?: {
  status?: SuggestionStatus;
}): Promise<{ ok: boolean; count: number }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);

  return requestJSON<{ ok: boolean; count: number }>(
    `/api/admin/suggestions/count?${qs.toString()}`,
    undefined,
    { auth: true },
  );
}

export async function adminFetchSuggestions(params?: {
  status?: SuggestionStatus;
  limit?: number;
}): Promise<ItemSuggestion[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.limit != null) qs.set("limit", String(params.limit));

  const data = await requestJSON<{ suggestions: ItemSuggestion[] }>(
    `/api/admin/suggestions?${qs.toString()}`,
    undefined,
    { auth: true },
  );

  return data.suggestions ?? [];
}

export async function adminApproveSuggestion(id: string): Promise<ItemSuggestion> {
  const data = await requestJSON<{ ok: boolean; suggestion: ItemSuggestion }>(
    `/api/admin/suggestions?action=approve&id=${encodeURIComponent(id)}`,
    { method: "POST" },
    { auth: true },
  );
  return data.suggestion;
}

export async function adminRejectSuggestion(id: string, note?: string | null) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/suggestions?action=reject&id=${encodeURIComponent(id)}`,
    {
      method: "POST",
      body: JSON.stringify({ note: (note ?? "").trim() || null }),
    },
    { auth: true },
  );
}

export async function adminDeleteSuggestion(id: string) {
  return requestJSON<{ ok: boolean }>(
    `/api/admin/suggestions?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
    { auth: true },
  );
}


/* =========================
   Admin AI
   ========================= */

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

export type AdminAutofillFromXResponse = {
  ok: true;
  title: string;
  description: string;
  comments: Array<{ text: string; translation_text: string | null }>;
};

export async function adminAutofillFromX(payload: {
  x_url: string;
  count: number;
  tone?: string;
}): Promise<AdminAutofillFromXResponse> {
  return requestJSON<AdminAutofillFromXResponse>(
    `/api/admin/x/autofill`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true },
  );
}