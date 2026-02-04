import { useMemo, useState } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Textarea from "../ui/Textarea";
import Select from "../ui/Select";
import Alert from "../ui/Alert";

import CommentsEditor, { type CommentDraft } from "../ops/CommentsEditor";
import type { Tone } from "../../lib/api";
import { adminGenerateAIComments } from "../../lib/api";

type Mode = "admin" | "public";

type Props = {
  open: boolean;
  mode: Mode;

  itemId: string;

  // Persian context
  titleFa: string;
  descriptionFa: string;

  // Optional: hashtag whitelist for draft editor validation/suggestions
  whitelist?: Set<string>;

  // Optional: existing comments pool for random/manual helpers
  existingCommentsPool?: Array<{ text: string }>;

  // When draft is produced and edited, you can apply it outside (optional)
  onApplyDrafts?: (drafts: CommentDraft[]) => void;

  // When save-to-db succeeds, close modal and refresh list outside
  onSaved?: () => void;

  onClose: () => void;
};

function normalizeTone(v: any): Tone {
  const t = String(v || "").trim();
  if (t === "friendly") return "friendly";
  if (t === "formal") return "formal";
  if (t === "neutral") return "neutral";
  if (t === "witty") return "witty";
  if (t === "professional") return "professional";
  return "neutral";
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, count);
}

function trimOrEmpty(v: any) {
  return String(v ?? "").trim();
}

// Minimal public call (replace with your lib/api function if exists)
async function publicGenerateOneComment(payload: {
  item_id: string;
  title_fa: string;
  description_fa: string;
  need_fa: string;
  comment_type_fa: string;
  tone: Tone;
}): Promise<{ text: string; translation_text: string }> {
  const res = await fetch("/api/ai/generate-comment", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      data?.message || data?.error || `Request failed with status ${res.status}`;
    throw new Error(msg);
  }

  if (!data?.comment?.text) throw new Error("NO_COMMENT_GENERATED");

  return {
    text: String(data.comment.text || ""),
    translation_text: String(data.comment.translation_text || ""),
  };
}

type ExamplesMode = "random_existing" | "manual" | "none";

export default function AICommentsModal(props: Props) {
  const isAdmin = props.mode === "admin";

  const [tone, setTone] = useState<Tone>("neutral");
  const [needFa, setNeedFa] = useState(
    "تولید ریپلای‌های کوتاه برای تعامل و ادامه گفتگو",
  );
  const [commentTypeFa, setCommentTypeFa] = useState("ریپلای کوتاه");

  const [count, setCount] = useState<number>(10);
  const [saveToDb, setSaveToDb] = useState<boolean>(false);

  const [examplesMode, setExamplesMode] = useState<ExamplesMode>(
    "random_existing",
  );
  const [manualExamples, setManualExamples] = useState<string[]>([]);

  const [drafts, setDrafts] = useState<CommentDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canUseRandomExamples =
    (props.existingCommentsPool?.length || 0) > 0;

  const effectiveExamplesMode = useMemo<ExamplesMode>(() => {
    if (!isAdmin) return "none";
    if (examplesMode === "random_existing" && !canUseRandomExamples) {
      return "manual";
    }
    return examplesMode;
  }, [examplesMode, isAdmin, canUseRandomExamples]);

  const modalTitle = isAdmin ? "ابزار AI برای کامنت‌ها" : "تولید کامنت با AI";

  const existingPoolTexts = useMemo(() => {
    return (props.existingCommentsPool || [])
      .map((c) => trimOrEmpty(c.text))
      .filter(Boolean);
  }, [props.existingCommentsPool]);

  function resetLocalState() {
    setErr(null);
    setDrafts([]);
    setLoading(false);

    setTone("neutral");
    setNeedFa("تولید ریپلای‌های کوتاه برای تعامل و ادامه گفتگو");
    setCommentTypeFa("ریپلای کوتاه");

    setCount(10);
    setSaveToDb(false);

    setExamplesMode("random_existing");
    setManualExamples([]);
  }

  function close() {
    if (loading) return; // prevent close while running
    resetLocalState();
    props.onClose();
  }

  function buildExamples(): Array<{ text: string }> {
    if (!isAdmin) return [];

    if (effectiveExamplesMode === "none") return [];

    if (effectiveExamplesMode === "random_existing") {
      return pickRandom(existingPoolTexts, 5).map((t) => ({ text: t }));
    }

    // manual
    return manualExamples
      .map((t) => String(t || "").trim())
      .filter((t) => t.length > 0)
      .slice(0, 5)
      .map((t) => ({ text: t }));
  }

  function addManualExample(text = "") {
    setManualExamples((prev) => {
      if (prev.length >= 5) return prev;
      return [...prev, text];
    });
  }

  function addOneRandomIntoManual() {
    if (!canUseRandomExamples) return;
    const available = existingPoolTexts.filter((t) => t.length > 0);
    if (available.length === 0) return;

    const picked = pickRandom(available, 1)[0];
    if (!picked) return;

    addManualExample(picked);
  }

  function fillManualWithFiveRandom() {
    if (!canUseRandomExamples) return;
    const picked = pickRandom(existingPoolTexts, 5);

    setManualExamples(() => picked.slice(0, 5));
    setExamplesMode("manual");
  }

  async function runAdmin() {
    const title_fa = trimOrEmpty(props.titleFa);
    const description_fa = trimOrEmpty(props.descriptionFa);

    if (!props.itemId) throw new Error("MISSING_ITEM_ID");
    if (!title_fa || !description_fa) throw new Error("MISSING_REQUIRED_FIELDS");

    const examples = buildExamples();
    if (effectiveExamplesMode === "manual" && examples.length === 0) {
      throw new Error("MANUAL_EXAMPLES_EMPTY");
    }

    const reqCount = Math.max(1, Math.min(20, Number(count) || 10));

    const res = await adminGenerateAIComments({
      item_id: props.itemId,
      title_fa,
      description_fa,
      need_fa: trimOrEmpty(needFa),
      comment_type_fa: trimOrEmpty(commentTypeFa),
      tone: normalizeTone(tone),
      examples,
      save: saveToDb,
      count: reqCount,
    } as any);

    const incoming: CommentDraft[] = (res.comments || []).map((c: any) => ({
      text: String(c.text || ""),
      translation_text:
        typeof c.translation_text === "string" ? c.translation_text : "",
    }));

    return { incoming, savedIds: res.saved_comment_ids || [] };
  }

  async function runPublic() {
    const title_fa = trimOrEmpty(props.titleFa);
    const description_fa = trimOrEmpty(props.descriptionFa);

    if (!props.itemId) throw new Error("MISSING_ITEM_ID");
    if (!title_fa || !description_fa) throw new Error("MISSING_REQUIRED_FIELDS");

    const c = await publicGenerateOneComment({
      item_id: props.itemId,
      title_fa,
      description_fa,
      need_fa: trimOrEmpty(needFa),
      comment_type_fa: trimOrEmpty(commentTypeFa),
      tone: normalizeTone(tone),
    });

    const incoming: CommentDraft[] = [
      { text: c.text, translation_text: c.translation_text },
    ];

    return { incoming };
  }

  async function handleGenerate() {
    setErr(null);

    if (!props.open) return;

    if (!props.itemId) {
      setErr("شناسه آیتم موجود نیست.");
      return;
    }

    setLoading(true);
    try {
      if (isAdmin) {
        const { incoming } = await runAdmin();

        if (saveToDb) {
          props.onSaved?.();
          close();
          return;
        }

        // Draft mode: show/edit in modal
        setDrafts((prev) => {
          const maxItems = 50;
          const space = Math.max(0, maxItems - prev.length);
          return [...prev, ...incoming.slice(0, space)];
        });
      } else {
        // Public: close on success
        const { incoming } = await runPublic();
        setDrafts(incoming);
        props.onSaved?.();
        close();
      }
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : "UNKNOWN_ERROR";

      if (msg === "MANUAL_EXAMPLES_EMPTY") {
        setErr("برای حالت مثال دستی، حداقل یک مثال وارد کنید.");
      } else if (msg === "MISSING_REQUIRED_FIELDS") {
        setErr("عنوان و توضیح آیتم باید موجود باشد.");
      } else if (msg === "MISSING_ITEM_ID") {
        setErr("شناسه آیتم موجود نیست.");
      } else {
        setErr(msg || "تولید با AI ناموفق بود.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleApplyDrafts() {
    if (!isAdmin) return;
    if (!props.onApplyDrafts) return;
    if (drafts.length === 0) return;

    props.onApplyDrafts(drafts);
    close();
  }

  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      dir="rtl"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={close}
        aria-hidden="true"
      />

      <div
        className="relative w-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-zinc-900">{modalTitle}</div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={close} disabled={loading}>
                بستن
              </Button>

              <Button variant="info" onClick={handleGenerate} disabled={loading}>
                {loading ? "در حال پردازش…" : "اجرا"}
              </Button>
            </div>
          </div>

          {err ? (
            <div className="mt-3">
              <Alert variant="error">{err}</Alert>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3">
            <div className="grid gap-2">
              <div className="text-xs text-zinc-600">لحن</div>
              <Select value={tone} onChange={(v) => setTone(v as Tone)} disabled={loading}>
                <option value="neutral">خنثی</option>
                <option value="friendly">دوستانه</option>
                <option value="formal">رسمی</option>
                <option value="witty">باهوش/طعنه ملایم</option>
                <option value="professional">حرفه‌ای</option>
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="text-xs text-zinc-600">نیاز (فارسی)</div>
              <Input
                value={needFa}
                onChange={setNeedFa}
                disabled={loading}
                placeholder="مثلاً: ریپلای کوتاه برای تعامل…"
              />
            </div>

            <div className="grid gap-2">
              <div className="text-xs text-zinc-600">نوع کامنت (فارسی)</div>
              <Input
                value={commentTypeFa}
                onChange={setCommentTypeFa}
                disabled={loading}
                placeholder="مثلاً: ریپلای کوتاه / سؤال‌محور…"
              />
            </div>

            {isAdmin ? (
              <div className="grid gap-2">
                <div className="text-xs text-zinc-600">تعداد خروجی</div>
                <Select
                  value={String(count)}
                  onChange={(v) => setCount(Number(v))}
                  disabled={loading}
                >
                  <option value="1">1</option>
                  <option value="3">3</option>
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="15">15</option>
                  <option value="20">20</option>
                </Select>
                <div className="text-xs text-zinc-500">
                  خروجی Draft داخل مودال قابل ویرایش است.
                </div>
              </div>
            ) : null}

            {isAdmin ? (
              <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-900">
                    ذخیره مستقیم در دیتابیس
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-600">
                    اگر فعال باشد، خروجی بلافاصله ذخیره می‌شود و پنجره بسته خواهد شد.
                  </div>
                </div>

                <input
                  type="checkbox"
                  className="h-5 w-5 accent-zinc-900"
                  checked={saveToDb}
                  onChange={(e) => setSaveToDb(e.target.checked)}
                  disabled={loading}
                  aria-label="Save directly"
                />
              </label>
            ) : null}

            {/* Examples (admin only) */}
            {isAdmin ? (
              <div className="grid gap-2">
                <div className="text-xs text-zinc-600">مثال‌ها (برای هدایت سبک)</div>

                <Select
                  value={effectiveExamplesMode}
                  onChange={(v: any) => setExamplesMode(v as ExamplesMode)}
                  disabled={loading}
                >
                  <option value="random_existing" disabled={!canUseRandomExamples}>
                    انتخاب تصادفی ۵ کامنت از کامنت‌های موجود
                  </option>
                  <option value="manual">ورود مثال‌های دستی</option>
                  <option value="none">بدون مثال</option>
                </Select>

                {effectiveExamplesMode === "manual" ? (
                  <div className="mt-2 grid gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-zinc-600">
                        مثال‌های انگلیسی (حداکثر ۵ مورد، چندخطی مجاز)
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {canUseRandomExamples ? (
                          <>
                            <Button
                              variant="secondary"
                              onClick={addOneRandomIntoManual}
                              disabled={loading || manualExamples.length >= 5}
                              title="یک مثال تصادفی از کامنت‌های موجود اضافه می‌کند"
                            >
                              + مثال تصادفی
                            </Button>

                            <Button
                              variant="secondary"
                              onClick={fillManualWithFiveRandom}
                              disabled={loading}
                              title="۵ مثال را با انتخاب تصادفی پر می‌کند"
                            >
                              پر کردن ۵ مثال
                            </Button>
                          </>
                        ) : null}

                        <Button
                          variant="secondary"
                          onClick={() => addManualExample("")}
                          disabled={loading || manualExamples.length >= 5}
                        >
                          + افزودن مثال
                        </Button>
                      </div>
                    </div>

                    {manualExamples.length === 0 ? (
                      <div className="text-xs text-zinc-500">
                        هنوز مثالی اضافه نشده. با «+ افزودن مثال» یا «+ مثال تصادفی» شروع کنید.
                      </div>
                    ) : null}

                    <div className="grid gap-2">
                      {manualExamples.map((ex, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="text-xs font-medium text-zinc-700">
                              مثال {idx + 1}
                            </div>

                            <Button
                              variant="danger"
                              onClick={() =>
                                setManualExamples((prev) =>
                                  prev.filter((_, i) => i !== idx),
                                )
                              }
                              disabled={loading}
                            >
                              حذف
                            </Button>
                          </div>

                          <Textarea
                            dir="ltr"
                            value={ex}
                            onChange={(v) => {
                              setManualExamples((prev) => {
                                const next = prev.slice();
                                next[idx] = v;
                                return next;
                              });
                            }}
                            placeholder="متن مثال انگلیسی (می‌تواند چندخطی باشد)..."
                            disabled={loading}
                          />

                          <div className="mt-2 text-xs text-zinc-500">
                            منشن (@...) و هشتگ (#...) داخل مثال مشکلی ندارد.
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-xs text-zinc-500">
                      نکته: اگر مثال‌ها زیاد طولانی باشند، بهتر است ۳–۵ خطی و شبیه سبک مدنظر باشند.
                    </div>
                  </div>
                ) : null}

                {!canUseRandomExamples && examplesMode === "random_existing" ? (
                  <div className="text-xs text-amber-700">
                    کامنتی برای انتخاب تصادفی موجود نیست؛ بهتر است «مثال دستی» را انتخاب کنید.
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Draft editor only for admin + saveToDb=false */}
            {isAdmin && !saveToDb ? (
              <div className="mt-2">
                <CommentsEditor
                  label="پیش‌نویس خروجی AI (قابل ویرایش)"
                  value={drafts}
                  onChange={setDrafts}
                  whitelist={props.whitelist ?? new Set()}
                  maxItems={50}
                  maxLen={1000}
                />

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-zinc-500">
                    این پیش‌نویس‌ها هنوز در دیتابیس ذخیره نشده‌اند.
                  </div>

                  {props.onApplyDrafts ? (
                    <Button
                      variant="success"
                      onClick={handleApplyDrafts}
                      disabled={loading || drafts.length === 0}
                    >
                      اعمال پیش‌نویس‌ها
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Public: show last generated (optional) */}
            {!isAdmin && drafts.length > 0 ? (
              <div className="mt-2">
                <CommentsEditor
                  label="خروجی تولید شده"
                  value={drafts}
                  onChange={setDrafts}
                  whitelist={props.whitelist ?? new Set()}
                  maxItems={5}
                  maxLen={1000}
                />
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}