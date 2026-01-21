import { useEffect, useState } from "react";
import { superadminCreateUser, superadminDeleteUser, superadminListUsers } from "../lib/api";
import type { UserRow } from "../lib/api";

const TOKEN_KEY = "admin:jwt";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string };

export default function SuperAdmin() {
  const token = localStorage.getItem(TOKEN_KEY) ?? "";

  const [users, setUsers] = useState<UserRow[]>([]);
  const [state, setState] = useState<State>({ status: "idle" });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");

  async function load() {
    setState({ status: "loading" });
    try {
      const list = await superadminListUsers();
      setUsers(list);
      setState({ status: "idle" });
    } catch {
      setState({ status: "error", message: "Forbidden or session expired." });
    }
  }

  useEffect(() => {
    if (!token) {
      setState({ status: "error", message: "Please login first." });
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate() {
    if (!username.trim() || password.length < 6) return;

    setState({ status: "loading" });
    try {
      await superadminCreateUser({
        username: username.trim(),
        password,
        email: email.trim() ? email.trim() : null,
        role,
      });

      setUsername("");
      setPassword("");
      setEmail("");
      setRole("admin");

      await load();
    } catch (e: any) {
      setState({ status: "error", message: "Could not create user (maybe username exists)." });
    }
  }

  async function onDelete(id: string) {
    setState({ status: "loading" });
    try {
      await superadminDeleteUser(id);
      await load();
    } catch {
      setState({ status: "error", message: "Could not delete user." });
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Super Admin</h1>
          <div className="mt-1 text-sm text-zinc-500">Manage users and roles.</div>
        </header>

        {state.status === "error" ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {state.message}
          </div>
        ) : null}

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3">
            <Input value={username} onChange={setUsername} placeholder="Username" />
            <Input value={password} onChange={setPassword} placeholder="Password (min 6 chars)" type="password" />
            <Input value={email} onChange={setEmail} placeholder="Email (optional)" />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-200"
            >
              <option value="admin">admin</option>
              <option value="editor">editor</option>
              <option value="superadmin">superadmin</option>
            </select>

            <button
              onClick={onCreate}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 transition"
            >
              Create user
            </button>

            <div className="text-xs text-zinc-500">
              Note: Creating a superadmin is allowed here; handle with care.
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 text-sm text-zinc-500">Users</div>

          {state.status === "loading" ? (
            <div className="text-zinc-500">Loading…</div>
          ) : users.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600 shadow-sm">
              No users.
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((u) => (
                <div key={u.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold">{u.username}</div>
                      <div className="mt-1 text-sm text-zinc-600">
                        {u.email ?? "—"} • <span className="font-medium">{u.role}</span>
                      </div>
                      <div className="mt-2 text-xs text-zinc-500">{new Date(u.created_at).toLocaleString()}</div>
                    </div>

                    <button
                      onClick={() => onDelete(u.id)}
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
          <a className="underline" href="/admin">
            admin
          </a>
        </footer>
      </div>
    </div>
  );
}

function Input(props: { value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <input
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      type={props.type ?? "text"}
      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
    />
  );
}
