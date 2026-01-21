import { useEffect, useMemo, useState } from "react";
import { adminCreateItem, adminDeleteItem, adminFetchItems, adminLogin } from "../lib/api";
import type { Item } from "../lib/api";
import { todayYYYYMMDD } from "../lib/date";

const TOKEN_KEY = "admin:jwt";

type LoginState =
  | { status: "ready" }
  | { status: "loading" }
  | { status: "error"; message: string };

export default function Admin() {
  const dateDefault = useMemo(() => todayYYYYMMDD(), []);
  const [date, setDate] = useState(dateDefault);

  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [actionType, setActionType] = useState("");

  // Login form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginState, setLoginState] = useState<LoginState>({ status: "ready" });

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setItems([]);
    setUsername("");
    setPassword("");
    setLoginState({ status: "ready" });
  }

  async function loadItems() {
    if (!token) return;
    setLoadingItems(true);
    try {
      const it = await adminFetchItems(date);
      setItems(it);
    } catch (e: any) {
      // If token is invalid/expired, backend returns 401.
      // We treat any failure here as a reason to logout to force re-login.
      logout();
      setLoginState({ status: "error", message: "Session expired. Please login again." });
    } finally {
      setLoadingItems(false);
    }
  }

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, date]);

  async function onCreate() {
    if (!title.trim() || !url.trim() || !description.trim()) return;

    await adminCreateItem({
      date,
      title: title.trim(),
      url: url.trim(),
      description: description.trim(),
      action_type: actionType.trim() ? actionType.trim() : null,
    });

    setTitle("");
    setUrl("");
    setDescription("");
    setActionType("");
    await loadItems();
  }

  async function onDelete(id: string) {
    await adminDeleteItem(id);
    await loadItems();
  }

  async function onLogin() {
    setLoginState({ status: "loading" });
    try {
      const res = await adminLogin(username.trim(), password);
      localStorage.setItem(TOKEN_KEY, res.token);
      setToken(res.token);
      setLoginState({ status: "ready" });
    } catch {
      setLoginState({ status: "error", message: "Invalid username or password." });
    }
  }

  // If no token => show login screen
  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-900">
        <div className="mx-auto max-w-md px-4 py-16">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold">Admin Login</h1>
            <p className="mt-1 text-sm text-zinc-500">Sign in to manage daily items.</p>

            <div className="mt-6 grid gap-3">
              <Input value={username} onChange={setUsername} placeholder="Username" autoComplete="username" />
              <Input
                value={password}
                onChange={setPassword}
                placeholder="Password"
                type="password"
                autoComplete="current-password"
              />

              <button
                onClick={onLogin}
                disabled={loginState.status === "loading" || !username.trim() || !password}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 transition disabled:opacity-50"
              >
                {loginState.status === "loading" ? "Signing in…" : "Sign in"}
              </button>

              {loginState.status === "error" ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {loginState.message}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-zinc-500">
            Back to{" "}
            <a className="underline" href="/">
              home
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Token exists => admin UI
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Admin</h1>
              <div className="mt-1 text-sm text-zinc-500">Add and manage daily items.</div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-600">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              />

              <button
                onClick={logout}
                className="ml-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3">
            <Input value={title} onChange={setTitle} placeholder="Title" />
            <Input value={url} onChange={setUrl} placeholder="URL" />
            <Input value={actionType} onChange={setActionType} placeholder="Action type (optional)" />
            <Textarea value={description} onChange={setDescription} placeholder="Short description" />

            <button
              onClick={onCreate}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 transition"
            >
              Add item
            </button>

            <div className="text-xs text-zinc-500">Tip: Keep descriptions short so users can move fast.</div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 text-sm text-zinc-500">Items for {date}</div>

          {loadingItems ? (
            <div className="text-zinc-500">Loading…</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600 shadow-sm">
              No items yet.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((i: any) => (
                <div key={i.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold">{i.title}</div>

                      <a
                        className="mt-1 block truncate text-sm text-zinc-600 underline"
                        href={i.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {i.url}
                      </a>

                      <div className="mt-2 text-sm text-zinc-700">{i.description}</div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {i.action_type ? (
                          <span className="inline-flex rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700">
                            {i.action_type}
                          </span>
                        ) : null}

                        <span className="text-xs text-zinc-500">
                          by {i.created_by_username ?? "unknown"} • {new Date(i.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => onDelete(i.id)}
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-10 text-xs text-zinc-500">
          Back to{" "}
          <a className="underline" href="/">
            home
          </a>
        </footer>
      </div>
    </div>
  );
}

function Input(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <input
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      type={props.type ?? "text"}
      autoComplete={props.autoComplete}
      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
    />
  );
}

function Textarea(props: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <textarea
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      className="min-h-[110px] rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
    />
  );
}
