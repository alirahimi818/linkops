import { useEffect, useState } from "react";
import AdminTable from "./AdminTable";
import InlineEdit from "./InlineEdit";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Alert from "../ui/Alert";
import { adminCreateCategory, adminDeleteCategory, adminFetchCategories, adminUpdateCategory } from "../../lib/api";
import type { Category } from "../../lib/api";

export default function SuperAdminCategories() {
  const [rows, setRows] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetchCategories();
      setRows(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setError(null);
    const n = name.trim();
    if (!n) return;

    try {
      await adminCreateCategory(n);
      setName("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Create failed.");
    }
  }

  async function rename(id: string, next: string) {
    await adminUpdateCategory(id, { name: next });
    await load();
  }

  async function del(id: string) {
    setError(null);
    try {
      await adminDeleteCategory(id);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Delete failed.");
    }
  }

  return (
    <div className="grid gap-4">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <AdminTable
        title="Categories"
        subtitle="Create and manage categories used on items."
        rows={rows}
        emptyText={loading ? "Loading…" : "No categories yet."}
        columns={[
          {
            key: "name",
            header: "Name",
            render: (r) => (
              <InlineEdit
                value={r.name}
                maxLen={60}
                onSave={(next) => rename(r.id, next)}
              />
            ),
          },
          {
            key: "actions",
            header: "",
            className: "w-[140px]",
            render: (r) => (
              <Button variant="secondary" onClick={() => del(r.id)}>
                Delete
              </Button>
            ),
          },
        ]}
      />

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-medium text-zinc-800">Add category</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="w-full max-w-sm">
            <Input value={name} onChange={setName} placeholder="e.g. Instagram, X, Review" />
          </div>
          <Button onClick={create} disabled={!name.trim()}>
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}
