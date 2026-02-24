// frontend/src/components/home/DeviceSyncButton.tsx
import { useEffect, useMemo, useState } from "react";

import Button from "../ui/Button";
import PortalModal from "../ui/PortalModal";

import {
  buildSyncUrl,
  getOrCreateDeviceId,
  isValidUuid,
  rotateDeviceId,
  setDeviceId,
} from "../../lib/deviceSync";

type Tab = "connect_new" | "restore_here";

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function SegmentedTabs(props: {
  value: Tab;
  onChange: (t: Tab) => void;
}) {
  const itemBase =
    "flex-1 rounded-xl px-1 md:px-3 py-2 text-sm transition border";
  const active =
    "bg-white border-zinc-200 text-zinc-900 shadow-sm";
  const inactive =
    "bg-transparent border-transparent text-zinc-600 hover:text-zinc-900 hover:bg-white/60";

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-2">
      <button
        type="button"
        className={clsx(itemBase, props.value === "connect_new" ? active : inactive)}
        onClick={() => props.onChange("connect_new")}
      >
        اتصال دستگاه جدید
      </button>

      <button
        type="button"
        className={clsx(itemBase, props.value === "restore_here" ? active : inactive)}
        onClick={() => props.onChange("restore_here")}
      >
        این دستگاه را وصل کن
      </button>
    </div>
  );
}

function InlineToast(props: { text: string; tone?: "success" | "warning" }) {
  const tone = props.tone ?? "success";
  return (
    <div
      className={clsx(
        "mb-3 rounded-xl border p-3 text-sm",
        tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-amber-200 bg-amber-50 text-amber-900"
      )}
    >
      {props.text}
    </div>
  );
}

export default function DeviceSyncButton() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("connect_new");

  const [revealed, setRevealed] = useState(false);

  const [toast, setToast] = useState<{ text: string; tone?: "success" | "warning" } | null>(null);

  const [restoreInput, setRestoreInput] = useState("");
  const [restoreBusy, setRestoreBusy] = useState(false);

  const code = useMemo(() => getOrCreateDeviceId(), []);
  const syncUrl = useMemo(() => buildSyncUrl(code), [code]);

  const qrImgSrc = useMemo(() => {
    // No extra deps: generate QR via image service
    const u = new URL("https://api.qrserver.com/v1/create-qr-code/");
    u.searchParams.set("size", "220x220");
    u.searchParams.set("margin", "10");
    u.searchParams.set("data", syncUrl);
    return u.toString();
  }, [syncUrl]);

  useEffect(() => {
    if (!open) return;
    // Reset modal state on open for clean UX
    setToast(null);
    setRevealed(false);
    setRestoreInput("");
    setRestoreBusy(false);
    setTab("connect_new");
  }, [open]);

  const copy = async (text: string, okMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ text: okMessage, tone: "success" });
    } catch {
      setToast({ text: "کپی انجام نشد؛ دستی کپی کن.", tone: "warning" });
    }
  };

  const onRestore = async () => {
    const v = restoreInput.trim();

    if (!isValidUuid(v)) {
      setToast({ text: "کد واردشده معتبر نیست. دوباره بررسی کن.", tone: "warning" });
      return;
    }

    setRestoreBusy(true);
    try {
      const ok = setDeviceId(v);
      if (!ok) {
        setToast({ text: "ذخیره‌سازی انجام نشد. (احتمالاً دسترسی مرورگر محدود است)", tone: "warning" });
        return;
      }

      window.dispatchEvent(new Event("status:changed"));
      setToast({ text: "این دستگاه با موفقیت وصل شد ✅", tone: "success" });
    } finally {
      setRestoreBusy(false);
    }
  };

  const onRotate = () => {
    const ok = window.confirm(
      "ساخت کد جدید باعث می‌شود دستگاه‌های قبلی دیگر به پروفایل فعلی وصل نباشند.\n\nادامه می‌دهی؟"
    );
    if (!ok) return;

    const next = rotateDeviceId();
    if (!next) {
      setToast({ text: "ساخت کد جدید انجام نشد. (مشکل در ذخیره‌سازی مرورگر)", tone: "warning" });
      return;
    }

    // Best UX: reload so all derived states align
    window.location.reload();
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        اتصال دستگاه جدید
      </Button>

      <PortalModal
        open={open}
        title="اتصال دستگاه‌ها"
        onClose={() => setOpen(false)}
        maxWidthClass="max-w-3xl"
      >
        {toast ? <InlineToast text={toast.text} tone={toast.tone} /> : null}

        <SegmentedTabs value={tab} onChange={setTab} />

        {tab === "connect_new" ? (
          <>
            <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-base text-zinc-900">روی دستگاه جدید چه کار کنم؟</div>
              <div className="mt-1 text-sm text-zinc-600">
                ساده‌ترین روش: QR را اسکن کن تا همان پروفایل روی دستگاه جدید باز شود.
                <br />
                اگر امکان اسکن نداری، می‌توانی لینک را کپی کنی یا کد را دستی وارد کنی.
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-sm font-medium text-zinc-900">QR برای باز کردن روی دستگاه جدید</div>
                  <div className="mt-3 flex justify-center">
                    <img
                      src={qrImgSrc}
                      alt="QR"
                      className="h-[220px] w-[220px] rounded-xl border border-zinc-200 bg-white"
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button variant="secondary" onClick={() => void copy(syncUrl, "لینک کپی شد.")}>
                      کپی لینک
                    </Button>

                    <a
                      href={syncUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-zinc-700 underline"
                    >
                      باز کردن لینک
                    </a>
                  </div>

                  <div className="mt-2 text-xs text-zinc-500">
                    نکته: لینک فقط برای اتصال دستگاه جدید است. بعد از باز شدن، آدرس صفحه خودکار تمیز می‌شود.
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-sm font-medium text-zinc-900">کد بازیابی</div>
                  <div className="mt-1 text-xs text-zinc-600">
                    این کد مخصوص توست. اگر اطلاعات مرورگر پاک شد یا دستگاه عوض کردی، با این کد می‌توانی برگردی.
                  </div>

                  <div className="mt-3">
                    {!revealed ? (
                      <Button variant="secondary" onClick={() => setRevealed(true)}>
                        نمایش کد
                      </Button>
                    ) : (
                      <>
                        <input
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                          value={code}
                          readOnly
                          dir="ltr"
                        />

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Button variant="secondary" onClick={() => void copy(code, "کد کپی شد.")}>
                            کپی کد
                          </Button>

                          <button
                            type="button"
                            className="text-sm text-zinc-700 underline"
                            onClick={() => setRevealed(false)}
                          >
                            مخفی کردن
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    اگر فکر می‌کنی کد در جایی لو رفته، می‌تونی کد جدید بسازی.
                    <div className="mt-2">
                      <Button variant="secondary" onClick={onRotate}>
                        ساخت کد جدید
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs text-zinc-500">
              حریم خصوصی: کد فقط روی همین مرورگر ذخیره می‌شود و به کسی ارسال نمی‌شود.
            </div>
          </>
        ) : (
          <>
            <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-base text-zinc-900">این دستگاه را به پروفایل قبلی وصل کن</div>
              <div className="mt-1 text-sm text-zinc-600">
                اگر الان روی یک دستگاه/مرورگر جدید هستی، کدی که از دستگاه قبلی گرفتی را اینجا وارد کن.
              </div>

              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                <label className="text-sm font-medium text-zinc-900">
                  وارد کردن کد
                </label>

                <input
                  className={clsx(
                    "mt-2 w-full rounded-xl border bg-white px-3 py-2 text-sm text-zinc-900",
                    restoreInput.trim() && !isValidUuid(restoreInput)
                      ? "border-rose-300"
                      : "border-zinc-200"
                  )}
                  value={restoreInput}
                  onChange={(e) => setRestoreInput(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  dir="ltr"
                  inputMode="text"
                  autoComplete="off"
                />

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button onClick={() => void onRestore()} disabled={restoreBusy}>
                    اتصال
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => {
                      setRestoreInput("");
                      setToast(null);
                    }}
                  >
                    پاک کردن
                  </Button>
                </div>

                <div className="mt-2 text-xs text-zinc-500">
                  بعد از اتصال موفق، همین دستگاه هم از همان پروفایل استفاده می‌کند.
                </div>
              </div>
            </div>
          </>
        )}
      </PortalModal>
    </>
  );
}