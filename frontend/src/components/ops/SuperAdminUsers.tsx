// frontend/src/components/ops/SuperAdminUsers.tsx
import { useEffect, useState } from "react";
import {
  superadminCreateUser,
  superadminDeleteUser,
  superadminListUsers,
  superadminUpdateUser,
} from "../../lib/api";
import type { UserRow } from "../../lib/api";

import Card from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Badge from "../ui/Badge";
import Alert from "../ui/Alert";
import Textarea from "../ui/Textarea";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string };

type EditState = { id: string } | null;

export default function SuperAdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [state, setState] = useState<State>({ status: "idle" });

  // shared form (create/edit)
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState(""); // optional in edit
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");

  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");

  const [editing, setEditing] = useState<EditState>(null);

  const isLoading = state.status === "loading";
  const isEdit = !!editing;

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

  function resetForm() {
    setUsername("");
    setPassword("");
    setEmail("");
    setRole("admin");

    setName("");
    setAvatarUrl("");
    setBio("");

    setEditing(null);
  }

  function startEdit(u: UserRow) {
    setState({ status: "idle" });

    setUsername(u.username ?? "");
    setPassword(""); // important: keep empty so it won't update unless typed
    setEmail(u.email ?? "");
    setRole(u.role ?? "admin");

    setName((u as any).name ?? "");
    setAvatarUrl((u as any).avatar_url ?? "");
    setBio((u as any).bio ?? "");

    setEditing({ id: u.id });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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

      resetForm();
      await load();
    } catch {
      setState({ status: "error", message: "Could not create user (maybe username exists)." });
    }
  }

  async function onUpdate() {
    if (!editing) return;
    if (!username.trim()) return;

    setState({ status: "loading" });
    try {
      const payload: {
        username?: string;
        password?: string;
        email?: string | null;
        role?: string;
        name?: string | null;
        avatar_url?: string | null;
        bio?: string | null;
      } = {
        username: username.trim(),
        email: email.trim() ? email.trim() : null,
        role,
        name: name.trim() ? name.trim() : null,
        avatar_url: avatarUrl.trim() ? avatarUrl.trim() : null,
        bio: bio.trim() ? bio.trim() : null,
      };

      // Only update password if user typed it
      if (password.trim()) {
        if (password.length < 6) {
          setState({ status: "error", message: "Password must be at least 6 characters." });
          return;
        }
        payload.password = password;
      }

      await superadminUpdateUser(editing.id, payload);

      resetForm();
      await load();
    } catch {
      setState({ status: "error", message: "Could not update user." });
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

  const createDisabled = !username.trim() || password.length < 6 || isLoading;
  const updateDisabled = !username.trim() || isLoading || (password.trim().length > 0 && password.length < 6);

  return (
    <div className="grid gap-4">
      {state.status === "error" ? <Alert variant="error">{state.message}</Alert> : null}

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm text-zinc-600">
            {isEdit ? (
              <span>
                Editing user <span className="font-mono">{editing?.id}</span>
              </span>
            ) : (
              <span>Create a new user</span>
            )}
          </div>

          {isEdit ? (
            <Button variant="ghost" onClick={resetForm} disabled={isLoading}>
              Cancel edit
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3">
          <Input value={username} onChange={setUsername} placeholder="Username" />

          <Input
            value={password}
            onChange={setPassword}
            placeholder={isEdit ? "Password (leave empty to keep unchanged)" : "Password (min 6 chars)"}
            type="password"
          />

          <Input value={email} onChange={setEmail} placeholder="Email (optional)" />

          <Select value={role} onChange={setRole}>
            <option value="admin">admin</option>
            <option value="editor">editor</option>
            <option value="superadmin">superadmin</option>
          </Select>

          <Input value={name} onChange={setName} placeholder="Name (optional)" />
          <Input dir="ltr" value={avatarUrl} onChange={setAvatarUrl} placeholder="Avatar URL (optional)" />
          <Textarea dir="auto" value={bio} onChange={setBio} placeholder="Bio (optional)" rows={4} />

          {isEdit ? (
            <Button onClick={onUpdate} disabled={updateDisabled}>
              Save changes
            </Button>
          ) : (
            <Button onClick={onCreate} disabled={createDisabled}>
              Create user
            </Button>
          )}

          <div className="text-xs text-zinc-500">
            Note: Creating a superadmin is allowed here; handle with care.
          </div>
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
                      {(u as any).name ? <Badge>{(u as any).name}</Badge> : null}
                    </div>

                    {(u as any).bio ? (
                      <div className="mt-2 text-sm text-zinc-600 whitespace-pre-wrap" dir="auto">
                        {(u as any).bio}
                      </div>
                    ) : null}

                    <div className="mt-2 text-xs text-zinc-500">{new Date(u.created_at).toLocaleString()}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="info" onClick={() => startEdit(u)} disabled={isLoading}>
                      Edit
                    </Button>

                    <Button variant="secondary" onClick={() => onDelete(u.id)} disabled={isLoading}>
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}