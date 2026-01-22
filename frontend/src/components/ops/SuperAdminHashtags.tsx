import { useEffect, useMemo, useState } from "react";
import AdminTable from "./AdminTable";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Alert from "../ui/Alert";
import Badge from "../ui/Badge";
import Select from "../ui/Select";

import {
  superadminCreateHashtag,
  superadminDeleteHashtag,
  superadminListHashtags,
  superadminUpdateHashtag,
} from "../../lib/api";

import type { HashtagWhitelistRow } from "../../lib/api";

function normalize(tag: string) {
  const t = tag.trim();
  const noHash = t.startsWith("#") ? t.slice(1) : t;
  return noHash.toLowerCase();
}

export default function SuperAdminHashtags() {
  const [rows, setRows] = useState<HashtagWhitelistRow[]>([]);
  const [tag, setTag] = useState("");
  const [priority, setPriority] = useState("10");
  const [active, setActive] = useState<"1" | "0">("1");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activeCount = useMemo(() => rows.filter(r => r.is_active === 1).length, [rows]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await superadminListHashtags();
      setRows(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load hashtags.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setError(null);
    const t = normalize(tag);
    const p = Number(priority);

    if (!t) return;

    try {
      await superadminCreateHashtag({
        tag: t,
        priority: Number.isFinite(p) ? p : 0,
        is_active: active === "1" ? 1 : 0,
      });
      setTag("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Create failed.");
    }
  }

  async function toggle(row: HashtagWhitelistRow) {
    await superadminUpdateHashtag(row.id, { is_active: row.is_active === 1 ? 0 : 1 });
    await load();
  }

  async function setRowPriority(row: HashtagWhitelistRow, p: number) {
    await superadminUpdateHashtag(row.id, { priority: p });
    await load();
  }

  async function del(id: string) {
    setError(null);
    try {
      await superadminDeleteHashtag(id);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Delete failed.");
    }
  }

  return (
    <div className="grid gap-4">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <AdminTable
        title="Hashtag whitelist"
        subtitle={`Active: ${activeCount} • Total: ${rows.length}`}
        rows={rows}
        emptyText={loading ? "Loading…" : "No hashtags yet."}
        columns={[
          {
            key: "tag",
            header: "Hashtag",
            render: (r) => (
              <div className="flex items-center gap-2">
                <span className="font-mono">#{r.tag}</span>
                {r.is_active === 1 ? (
                  <Badge>active</Badge>
                ) : (
                  <span className="text-xs text-zinc-500">inactive</span>
                )}
              </div>
            ),
          },
          {
            key: "priority",
            header: "Priority",
            className: "w-[220px]",
            render: (r) => (
              <div className="flex items-center gap-2">
                <Input
                  value={String(r.priority)}
                  onChange={(v) => setRowPriority(r, Number(v))}
                  placeholder="0"
                />
              </div>
            ),
          },
          {
            key: "state",
            header: "",
            className: "w-[150px]",
            render: (r) => (
              <Button variant="secondary" onClick={() => toggle(r)}>
                {r.is_active === 1 ? "Disable" : "Enable"}
              </Button>
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
        <div className="text-sm font-medium text-zinc-800">Add hashtag</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="w-2/5 flex flex-col gap-0.5">
            <label htmlFor="tag">Hashtag</label>
            <Input value={tag} onChange={setTag} placeholder="e.g. #myhashtag" />
          </div>

          <div className="w-1/5 flex flex-col gap-0.5">
            <label htmlFor="priority">Priority</label>
            <Input value={priority} onChange={setPriority} placeholder="priority" />
          </div>

          <div className="w-1/5 flex flex-col gap-0.5">
            <label htmlFor="is_active">Status</label>
            <Select value={active} onChange={(v) => setActive(v as any)}>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </Select>
          </div>

          <Button className="mt-6" onClick={create} disabled={!tag.trim()}>
            Create
          </Button>
        </div>

        <div className="mt-3 text-xs text-zinc-500">
          Tip: Use higher priority for hashtags you want users to focus on.
        </div>
      </div>
    </div>
  );
}
