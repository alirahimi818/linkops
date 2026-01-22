import { useEffect, useState } from "react";
import AdminTable from "./AdminTable";
import InlineEdit from "./InlineEdit";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Alert from "../ui/Alert";

import {
  adminCreateCategory,
  adminDeleteCategory,
  adminFetchCategories,
  adminUpdateCategory,
} from "../../lib/api";

import type { Category } from "../../lib/api";

type EditDraft = { name: string; image: string };

function safeStr(v: any) {
  return typeof v === "string" ? v : "";
}

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

  async function update(id: string, draft: EditDraft) {
    const n = draft.name.trim();
    const img = draft.image.trim();
    if (!n) throw new Error("Name is required.");
    if (n.length > 60) throw new Error("Name is too long (max 60).");
    if (img.length > 400) throw new Error("Image URL is too long.");
    await adminUpdateCategory(id, { name: n, image: img ? img : null });
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
            key: "main",
            render: (r) => (
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="shrink-0">
                  {r.image ? (
                    <img
                      src={r.image}
                      alt={r.name}
                      className="h-10 w-10 rounded-xl border border-zinc-200 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-xl border border-zinc-200 bg-zinc-50" />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-zinc-900">{r.name}</div>
                  </div>
                  
                  {/* Inline edit */}
                  <div className="mt-2">
                    <InlineEdit<EditDraft>
                      value={{ name: safeStr(r.name), image: safeStr(r.image) }}
                      renderDisplay={() => (
                        <div className="text-xs text-zinc-500">
                          Edit name & image
                        </div>
                      )}
                      renderEditor={(draft, setDraft) => (
                        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
                          <div className="w-full md:w-[240px]">
                            <Input
                              value={draft.name}
                              onChange={(v) => setDraft({ ...draft, name: v })}
                              placeholder="Name"
                            />
                          </div>
                          <div className="w-full md:w-[420px]">
                            <Input
                              value={draft.image}
                              onChange={(v) => setDraft({ ...draft, image: v })}
                              placeholder="Image URL (optional)"
                            />
                          </div>
                        </div>
                      )}
                      validate={(d) => {
                        const n = d.name.trim();
                        const img = d.image.trim();
                        if (!n) return "Name is required.";
                        if (n.length > 60) return "Name is too long (max 60).";
                        if (img.length > 400) return "Image URL is too long.";
                        return null;
                      }}
                      onSave={async (draft) => {
                        await update(r.id, draft);
                        await load();
                      }}
                    />
                  </div>
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

        <div className="mt-2 text-xs text-zinc-500">
          Image is optional. Use a square icon for best results.
        </div>
      </div>
    </div>
  );
}
