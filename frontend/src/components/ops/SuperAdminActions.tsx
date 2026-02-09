import { useEffect, useState } from "react";
import AdminTable from "./AdminTable";
import InlineEdit from "./InlineEdit";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Alert from "../ui/Alert";

import {
  superadminCreateAction,
  superadminDeleteAction,
  superadminListActions,
  superadminUpdateAction,
} from "../../lib/api";

import type { Action } from "../../lib/api";

type EditDraft = { name: string; label: string };

function safeStr(v: any) {
  return typeof v === "string" ? v : "";
}

function normalizeName(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export default function SuperAdminActions() {
  const [rows, setRows] = useState<Action[]>([]);
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await superadminListActions();
      setRows(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load actions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setError(null);

    const n = normalizeName(name);
    const l = label.trim();

    if (!n || !l) return;

    try {
      await superadminCreateAction({ name: n, label: l });
      setName("");
      setLabel("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Create failed.");
    }
  }

  async function update(id: string, draft: EditDraft) {
    const n = normalizeName(draft.name);
    const l = draft.label.trim();

    if (!n) throw new Error("Name is required.");
    if (n.length > 40) throw new Error("Name is too long (max 40).");
    if (!/^[a-z0-9_]+$/.test(n)) throw new Error("Name can only contain a-z, 0-9 and underscore.");
    if (!l) throw new Error("Label is required.");
    if (l.length > 60) throw new Error("Label is too long (max 60).");

    await superadminUpdateAction(id, { name: n, label: l });
  }

  async function del(id: string) {
    setError(null);
    try {
      await superadminDeleteAction(id);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Delete failed.");
    }
  }

  return (
    <div className="grid gap-4">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <AdminTable<Action>
        title="Actions"
        subtitle="Create and manage actions that admins can select on items."
        rows={rows}
        rowKey={(r) => r.id}
        emptyText={loading ? "Loading…" : "No actions yet."}
        columns={[
          {
            key: "main",
            render: (r) => (
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm  text-zinc-900">{r.label}</div>
                  <div className="text-xs text-zinc-500">({r.name})</div>
                </div>

                <div className="mt-2">
                  <InlineEdit<EditDraft>
                    value={{ name: safeStr(r.name), label: safeStr(r.label) }}
                    renderDisplay={() => (
                      <div className="text-xs text-zinc-500">Edit name & label</div>
                    )}
                    renderEditor={(draft, setDraft) => (
                      <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
                        <div className="w-full md:w-[220px]">
                          <Input
                            value={draft.name}
                            onChange={(v) => setDraft({ ...draft, name: v })}
                            placeholder="name (e.g. like, comment)"
                          />
                        </div>
                        <div className="w-full md:w-[320px]">
                          <Input
                            value={draft.label}
                            onChange={(v) => setDraft({ ...draft, label: v })}
                            placeholder="label (e.g. Like, Comment)"
                          />
                        </div>
                      </div>
                    )}
                    validate={(d) => {
                      const n = normalizeName(d.name);
                      const l = d.label.trim();
                      if (!n) return "Name is required.";
                      if (n.length > 40) return "Name is too long (max 40).";
                      if (!/^[a-z0-9_]+$/.test(n)) return "Name can only contain a-z, 0-9 and underscore.";
                      if (!l) return "Label is required.";
                      if (l.length > 60) return "Label is too long (max 60).";
                      return null;
                    }}
                    onSave={async (draft) => {
                      await update(r.id, draft);
                      await load();
                    }}
                  />
                </div>
              </div>
            ),
          },
        ]}
        rowActions={(r) => (
          <>
            <Button variant="secondary" onClick={() => del(r.id)}>
              Delete
            </Button>
          </>
        )}
      />

      {/* Create */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-medium text-zinc-800">Add action</div>

        <div className="w-full mt-2 flex flex-wrap items-center gap-2">
          <div className="w-full md:w-[240px] flex flex-col gap-0.5">
            <label className="block text-xs text-zinc-600 mb-1">Name</label>
            <Input
              value={name}
              onChange={setName}
              placeholder="e.g. like, comment, rate"
            />
          </div>

          <div className="w-full md:w-[320px] flex flex-col gap-0.5">
            <label className="block text-xs text-zinc-600 mb-1">Label</label>
            <Input
              value={label}
              onChange={setLabel}
              placeholder="e.g. Like, Comment, Rate"
            />
          </div>

          <Button className="mt-6" onClick={create} disabled={!name.trim() || !label.trim()}>
            Create
          </Button>
        </div>

        <div className="mt-2 text-xs text-zinc-500">
          Name is normalized to <code className="px-1 py-0.5 bg-zinc-100 rounded">snake_case</code>.
        </div>
      </div>
    </div>
  );
}