import { useEffect, useState } from "react";
import AdminTable from "./AdminTable";
import InlineEdit from "./InlineEdit";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Alert from "../ui/Alert";
import Badge from "../ui/Badge";

import {
  adminCreateCategory,
  adminDeleteCategory,
  adminFetchCategories,
  adminUpdateCategory,
} from "../../lib/api";

import type { Category } from "../../lib/api";

type EditCategoryDraft = { name: string; image: string };

export default function SuperAdminCategories() {
  const [rows, setRows] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [image, setImage] = useState("");

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
    const img = image.trim();
    if (!n) return;

    try {
      await adminCreateCategory(n, img);
      setName("");
      setImage("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Create failed.");
    }
  }

  async function update(id: string, draft: EditCategoryDraft) {
    await adminUpdateCategory(id, { name: draft.name.trim(), image: draft.image.trim() });
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

      <AdminTable<Category>
        title="Categories"
        subtitle="Create and manage categories used on items."
        rows={rows}
        rowKey={(r) => r.id}
        emptyText={loading ? "Loading…" : "No categories yet."}
        columns={[
          {
            key: "name",
            header: "Name",
            className: "md:col-span-4",
            render: (r) => (
              <div className="flex items-center gap-2">
                <span className="font-medium">{r.name}</span>
              </div>
            ),
          },
          {
            key: "image",
            header: "Image",
            className: "md:col-span-6",
            render: (r) => (
              <div className="flex items-center gap-3">
                {r.image ? (
                  <img
                    src={r.image}
                    alt={r.name}
                    className="h-8 w-8 rounded-lg border border-zinc-200 object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-lg border border-zinc-200 bg-zinc-50" />
                )}
                <div className="min-w-0">
                  {r.image ? (
                    <a className="block truncate text-sm text-zinc-700 underline" href={r.image} target="_blank" rel="noreferrer">
                      {r.image}
                    </a>
                  ) : (
                    <span className="text-sm text-zinc-500">—</span>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: "edit",
            header: "Edit",
            className: "md:col-span-2",
            render: (r) => (
              <InlineEdit<EditCategoryDraft>
                value={{ name: r.name ?? "", image: r.image ?? "" }}
                renderDisplay={(v) => (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>Edit</Badge>
                    <span className="text-xs text-zinc-500">name & image</span>
                  </div>
                )}
                renderEditor={(draft, setDraft) => (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-full md:w-[220px]">
                      <Input
                        value={draft.name}
                        onChange={(v) => setDraft({ ...draft, name: v })}
                        placeholder="Name"
                      />
                    </div>
                    <div className="w-full md:w-[360px]">
                      <Input
                        value={draft.image}
                        onChange={(v) => setDraft({ ...draft, image: v })}
                        placeholder="Image URL (optional)"
                      />
                    </div>
                  </div>
                )}
                validate={(d) => {
                  if (!d.name.trim()) return "Name is required.";
                  if (d.name.trim().length > 60) return "Name is too long (max 60).";
                  if (d.image.trim().length > 300) return "Image URL is too long.";
                  return null;
                }}
                onSave={async (draft) => {
                  await update(r.id, draft);
                  await load();
                }}
              />
            ),
          },
        ]}
        rowActions={(r) => (
          <Button variant="secondary" onClick={() => del(r.id)}>
            Delete
          </Button>
        )}
      />

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-medium text-zinc-800">Add category</div>

        <div className="w-full mt-2 flex flex-wrap items-center gap-2">
          <div className="w-1/3 flex flex-col gap-0.5">
            <label className="block text-xs text-zinc-600 mb-1">Name</label>
            <Input value={name} onChange={setName} placeholder="e.g. Instagram, X, Review" />
          </div>

          <div className="w-1/3 flex flex-col gap-0.5">
            <label className="block text-xs text-zinc-600 mb-1">Image URL</label>
            <Input value={image} onChange={setImage} placeholder="e.g. https://.../logo.png" />
          </div>

          <Button className="mt-6" onClick={create} disabled={!name.trim()}>
            Create
          </Button>
        </div>

        <div className="mt-2 text-xs text-zinc-500">Image is optional. Use a small square icon for best results.</div>
      </div>
    </div>
  );
}
