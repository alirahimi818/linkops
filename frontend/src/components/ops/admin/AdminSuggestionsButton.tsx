// frontend/src/components/ops/admin/AdminSuggestionsButton.tsx
import { useEffect, useMemo, useState } from "react";
import Button from "../../ui/Button";
import Card from "../../ui/Card";
import Alert from "../../ui/Alert";
import Input from "../../ui/Input";

import type { ItemSuggestion } from "../../../lib/api";
import {
  adminApproveSuggestion,
  adminDeleteSuggestion,
  adminFetchSuggestions,
  adminRejectSuggestion,
  adminSuggestionsCount,
} from "../../../lib/api";

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">
      {n}
    </span>
  );
}

function ModalShell(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={props.onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center p-3">
        <div className="w-full max-w-3xl">
          <Card>
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-3">
              <div className="text-sm font-medium text-zinc-900">
                {props.title}
              </div>
              <Button variant="secondary" onClick={props.onClose}>
                بستن
              </Button>
            </div>

            <div className="pt-3">{props.children}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AdminSuggestionsButton(props: {
  // When admin clicks "Approve & Use"
  onUseSuggestion: (s: ItemSuggestion) => void;

  // Optional: called after any change to refresh outside state if needed
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);

  const [count, setCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(false);

  const [loadingList, setLoadingList] = useState(false);
  const [suggestions, setSuggestions] = useState<ItemSuggestion[]>([]);

  const [error, setError] = useState<string | null>(null);

  // Per-row UI state
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  const pendingCountLabel = useMemo(() => {
    if (loadingCount) return "پیشنهادها…";
    return "پیشنهادهای کاربران";
  }, [loadingCount]);

  async function refreshCount() {
    setLoadingCount(true);
    try {
      const res = await adminSuggestionsCount({ status: "pending" });
      setCount(Number(res?.count ?? 0));
    } catch (e: any) {
      // silent; badge is not critical
      // eslint-disable-next-line no-console
      console.error("suggestions count failed:", e);
    } finally {
      setLoadingCount(false);
    }
  }

  async function refreshList() {
    setLoadingList(true);
    setError(null);
    try {
      const rows = await adminFetchSuggestions({ status: "pending", limit: 100 });
      setSuggestions(rows);
    } catch (e: any) {
      setError(e?.message ?? "بارگذاری پیشنهادها ناموفق بود.");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    refreshCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load list on open
  useEffect(() => {
    if (!open) return;
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function approveAndUse(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const s = await adminApproveSuggestion(id);

      // Remove from modal list immediately
      setSuggestions((p) => p.filter((x) => x.id !== id));

      // Update badge
      setCount((c) => Math.max(0, c - 1));

      props.onUseSuggestion(s);
      setOpen(false);

      props.onChanged?.();
    } catch (e: any) {
      setError(e?.message ?? "تایید پیشنهاد ناموفق بود.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const note = (rejectNotes[id] ?? "").trim() || null;
      await adminRejectSuggestion(id, note);

      setSuggestions((p) => p.filter((x) => x.id !== id));
      setCount((c) => Math.max(0, c - 1));

      props.onChanged?.();
    } catch (e: any) {
      setError(e?.message ?? "رد پیشنهاد ناموفق بود.");
    } finally {
      setBusyId(null);
    }
  }

  async function del(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await adminDeleteSuggestion(id);

      setSuggestions((p) => p.filter((x) => x.id !== id));
      setCount((c) => Math.max(0, c - 1));

      props.onChanged?.();
    } catch (e: any) {
      setError(e?.message ?? "حذف پیشنهاد ناموفق بود.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm text-zinc-700">
          پیشنهادهای کاربران بدون لاگین (با device_id)
        </div>

        <Button
          variant="secondary"
          onClick={() => setOpen(true)}
          disabled={loadingCount}
        >
          <span className="flex items-center gap-2">
            {pendingCountLabel}
            <Badge n={count} />
          </span>
        </Button>
      </div>

      <ModalShell
        open={open}
        title={`پیشنهادهای در انتظار (${suggestions.length})`}
        onClose={() => setOpen(false)}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="text-xs text-zinc-500">
            تایید و استفاده → فرم بالای صفحه پر می‌شود.
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              await refreshList();
              await refreshCount();
            }}
            disabled={loadingList}
          >
            {loadingList ? "در حال بروزرسانی…" : "بروزرسانی"}
          </Button>
        </div>

        {error ? (
          <Alert variant="error" className="mb-3">
            {error}
          </Alert>
        ) : null}

        {loadingList ? (
          <div className="text-sm text-zinc-600">در حال بارگذاری…</div>
        ) : suggestions.length === 0 ? (
          <div className="text-sm text-zinc-600">
            موردی در انتظار بررسی نیست.
          </div>
        ) : (
          <div className="grid gap-3">
            {suggestions.map((s) => {
              const isBusy = busyId === s.id;
              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-zinc-200 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-900">
                        {s.title?.trim() ? s.title : "بدون عنوان"}
                      </div>

                      <a
                        className="mt-1 block text-xs text-blue-700 underline break-all"
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        dir="ltr"
                      >
                        {s.url}
                      </a>

                      {s.description ? (
                        <div className="mt-2 text-sm text-zinc-700 whitespace-pre-wrap">
                          {s.description}
                        </div>
                      ) : null}

                      {s.device_id ? (
                        <div className="mt-2 text-[11px] text-zinc-500">
                          device_id:{" "}
                          <span className="font-mono" dir="ltr">
                            {s.device_id}
                          </span>
                        </div>
                      ) : null}

                      <div className="mt-2 text-[11px] text-zinc-500">
                        created_at:{" "}
                        <span className="font-mono" dir="ltr">
                          {s.created_at}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <Button
                        variant="success"
                        onClick={() => approveAndUse(s.id)}
                        disabled={isBusy}
                      >
                        {isBusy ? "…" : "تایید و استفاده"}
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={() => reject(s.id)}
                        disabled={isBusy}
                      >
                        رد
                      </Button>

                      <Button
                        variant="danger"
                        onClick={() => del(s.id)}
                        disabled={isBusy}
                      >
                        حذف
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2">
                    <div className="text-xs text-zinc-600">
                      یادداشت رد (اختیاری)
                    </div>
                    <Input
                      value={rejectNotes[s.id] ?? ""}
                      onChange={(v) =>
                        setRejectNotes((p) => ({ ...p, [s.id]: v }))
                      }
                      placeholder="مثلاً: تکراری / نامرتبط / لینک خراب…"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ModalShell>
    </>
  );
}
