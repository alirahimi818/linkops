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

  const activeCount = useMemo(
    () => rows.filter((r) => r.is_active === 1).length,
    [rows],
  );

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
      setPriority("10");
      setActive("1");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Create failed.");
    }
  }

  async function toggle(row: HashtagWhitelistRow) {
    setError(null);
    try {
      await superadminUpdateHashtag(row.id, {
        is_active: row.is_active === 1 ? 0 : 1,
      });
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Update failed.");
    }
  }

  async function setRowPriority(row: HashtagWhitelistRow, v: string) {
    // Allow empty while typing, but don't send NaN
    const n = Number(v);
    if (!Number.isFinite(n)) return;

    setError(null);
    try {
      await superadminUpdateHashtag(row.id, { priority: n });
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Update failed.");
    }
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

      <AdminTable<HashtagWhitelistRow>
        title="Hashtag whitelist"
        subtitle={`Active: ${activeCount} • Total: ${rows.length}`}
        rows={rows}
        rowKey={(r) => r.id}
        emptyText={loading ? "Loading…" : "No hashtags yet."}
        columns={[
          {
            key: "tag",
            render: (r) => (
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">#{r.tag}</span>
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
            render: (r) => (
              <div className="mt-1 flex items-center gap-2">
                <div className="text-xs text-zinc-500 w-[70px]">Priority</div>
                <div className="max-w-[140px]">
                  <Input
                    value={String(r.priority)}
                    onChange={(v) => setRowPriority(r, v)}
                    placeholder="0"
                    inputMode="numeric"
                  />
                </div>
              </div>
            ),
          },
        ]}
        rowActions={(r) => (
          <>
            <Button variant="secondary" onClick={() => toggle(r)}>
              {r.is_active === 1 ? "Disable" : "Enable"}
            </Button>
            <Button variant="secondary" onClick={() => del(r.id)}>
              Delete
            </Button>
          </>
        )}
      />

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-medium text-zinc-800">Add hashtag</div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="w-2/5 flex flex-col gap-0.5">
            <label className="block text-xs text-zinc-600 mb-1" htmlFor="tag">
              Hashtag
            </label>
            <Input
              value={tag}
              onChange={setTag}
              placeholder="e.g. #myhashtag"
            />
          </div>

          <div className="w-1/5 flex flex-col gap-0.5">
            <label
              className="block text-xs text-zinc-600 mb-1"
              htmlFor="priority"
            >
              Priority
            </label>
            <Input
              value={priority}
              onChange={setPriority}
              placeholder="10"
              inputMode="numeric"
            />
          </div>

          <div className="w-1/5 flex flex-col gap-0.5">
            <label
              className="block text-xs text-zinc-600 mb-1"
              htmlFor="is_active"
            >
              Status
            </label>
            <Select value={active} onChange={(v) => setActive(v as any)}>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </Select>
          </div>

          <Button className="mt-6" onClick={create} disabled={!tag.trim()}>
            Create
          </Button>
        </div>

        <div className="mt-2 text-xs text-zinc-500">
          Tip: Use higher priority for hashtags you want users to focus on.
        </div>
      </div>
    </div>
  );
}
