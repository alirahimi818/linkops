// frontend/src/components/ops/SuperAdminUsers.tsx
import { useEffect, useState } from "react";
import { superadminCreateUser, superadminDeleteUser, superadminListUsers } from "../../lib/api";
import type { UserRow } from "../../lib/api";

import Card from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Badge from "../ui/Badge";
import Alert from "../ui/Alert";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string };

export default function SuperAdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [state, setState] = useState<State>({ status: "idle" });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");

  const isLoading = state.status === "loading";

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
    } catch {
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
    <div className="grid gap-4">
      {state.status === "error" ? (
        <Alert variant="error">
          {state.message}
        </Alert>
      ) : null}

      <Card>
        <div className="grid gap-3">
          <Input value={username} onChange={setUsername} placeholder="Username" />
          <Input value={password} onChange={setPassword} placeholder="Password (min 6 chars)" type="password" />
          <Input value={email} onChange={setEmail} placeholder="Email (optional)" />

          <Select value={role} onChange={setRole}>
            <option value="admin">admin</option>
            <option value="editor">editor</option>
            <option value="superadmin">superadmin</option>
          </Select>

          <Button onClick={onCreate} disabled={!username.trim() || password.length < 6 || isLoading}>
            Create user
          </Button>

          <div className="text-xs text-zinc-500">Note: Creating a superadmin is allowed here; handle with care.</div>
        </div>
      </Card>

      <section>
        <div className="mb-3 text-sm text-zinc-500">Users</div>

        {state.status === "loading" ? (
          <div className="text-zinc-500">Loading…</div>
        ) : users.length === 0 ? (
          <Card className="p-6 text-zinc-600">No users.</Card>
        ) : (
          <div className="space-y-3">
            {users.map((u) => (
              <Card key={u.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold">{u.username}</div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge>{u.role}</Badge>
                      <span className="text-sm text-zinc-600">{u.email ?? "—"}</span>
                    </div>

                    <div className="mt-2 text-xs text-zinc-500">{new Date(u.created_at).toLocaleString()}</div>
                  </div>

                  <Button variant="secondary" onClick={() => onDelete(u.id)} disabled={isLoading}>
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
