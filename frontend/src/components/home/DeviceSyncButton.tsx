// frontend/src/components/home/DeviceSyncButton.tsx
import { useEffect, useMemo, useRef, useState } from "react";

import Button from "../ui/Button";
import PortalModal from "../ui/PortalModal";

import {
  buildSyncUrl,
  getOrCreateDeviceId,
  isValidUuid,
  rotateDeviceId,
  setDeviceId,
} from "../../lib/deviceSync";

import { toDataURL } from "qrcode";
import CopyPill from "../ui/CopyPill";

// ---------------------------------------------------------------------------
// InlineToast
// ---------------------------------------------------------------------------

type ToastTone = "success" | "warning" | "error";

interface ToastState {
  id: number;
  text: string;
  tone: ToastTone;
}

function InlineToast({
  toast,
  onDone,
}: {
  toast: ToastState;
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animate in on mount / when toast changes
  useEffect(() => {
    // Trigger enter animation on next paint
    const raf = requestAnimationFrame(() => setVisible(true));

    timerRef.current = setTimeout(() => setVisible(false), 3200);

    return () => {
      cancelAnimationFrame(raf);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id]);

  // After fade-out, notify parent
  useEffect(() => {
    if (visible) return;
    const t = setTimeout(onDone, 350);
    return () => clearTimeout(t);
  }, [visible, onDone]);

  const colorMap: Record<ToastTone, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-rose-200 bg-rose-50 text-rose-900",
  };

  const iconMap: Record<ToastTone, string> = {
    success: "✅",
    warning: "⚠️",
    error: "❌",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "mb-3 flex items-center gap-2 rounded-xl border p-3 text-sm",
        "transition-all duration-300 ease-in-out",
        colorMap[toast.tone],
        visible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
      ].join(" ")}
    >
      <span>{iconMap[toast.tone]}</span>
      <span>{toast.text}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small reusable pieces
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-base font-medium text-zinc-900">{children}</div>
  );
}

function SectionDesc({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 text-sm text-zinc-500">{children}</div>
  );
}

function Divider() {
  return <div className="my-4 border-t border-zinc-100" />;
}

// ---------------------------------------------------------------------------
// Step 1 — Share to new device
// ---------------------------------------------------------------------------

function ShareStep({ syncUrl }: { syncUrl: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setQrBusy(true);
      try {
        const dataUrl = await toDataURL(syncUrl, {
          margin: 1,
          width: 200,
          errorCorrectionLevel: "M",
        });
        if (alive) setQrDataUrl(dataUrl);
      } catch {
        if (alive) setQrDataUrl(null);
      } finally {
        if (alive) setQrBusy(false);
      }
    })();
    return () => { alive = false; };
  }, [syncUrl]);

  return (
    <div className="space-y-4">
      {/* QR — primary action */}
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        {qrBusy ? (
          <div className="flex h-[200px] w-[200px] items-center justify-center rounded-xl border border-zinc-200 bg-white text-sm text-zinc-400">
            در حال ساخت QR...
          </div>
        ) : qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="QR Code برای انتقال پروفایل"
            className="h-[200px] w-[200px] rounded-xl border border-zinc-200 bg-white"
          />
        ) : (
          <div className="flex h-[200px] w-[200px] items-center justify-center rounded-xl border border-zinc-200 bg-white text-sm text-zinc-400">
            QR آماده نشد
          </div>
        )}

        <p className="text-center text-sm text-zinc-500">
          روی دستگاه جدید QR را اسکن کن
        </p>
      </div>

      {/* Link — secondary action */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="text-sm font-medium text-zinc-700">
          یا لینک را کپی کن
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <CopyPill
            value={syncUrl}
            label="کپی لینک"
            dir="auto"
            className="rounded-xl py-2 text-sm"
          />
          <a
            href={syncUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-700"
          >
            باز کردن
          </a>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          بعد از باز شدن، آدرس صفحه خودکار تمیز می‌شود.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Restore on this device
// ---------------------------------------------------------------------------

function RestoreStep({
  onSuccess,
  onToast,
}: {
  onSuccess: () => void;
  onToast: (text: string, tone: ToastTone) => void;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const invalid = input.trim().length > 0 && !isValidUuid(input.trim());

  const handleRestore = async () => {
    const v = input.trim();
    if (!isValidUuid(v)) {
      onToast("کد واردشده معتبر نیست. دوباره بررسی کن.", "warning");
      return;
    }

    setBusy(true);
    try {
      const ok = setDeviceId(v);
      if (!ok) {
        onToast("ذخیره‌سازی انجام نشد. (احتمالاً دسترسی مرورگر محدود است)", "error");
        return;
      }
      window.dispatchEvent(new Event("status:changed"));
      onToast("این دستگاه با موفقیت وصل شد", "success");
      onSuccess();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <SectionTitle>وارد کردن کد بازیابی</SectionTitle>
      <SectionDesc>
        کدی که از دستگاه قبلی کپی کردی را اینجا وارد کن.
      </SectionDesc>

      <input
        className={[
          "mt-3 w-full rounded-xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none",
          "transition focus:ring-2 focus:ring-zinc-300",
          invalid ? "border-rose-300" : "border-zinc-200",
        ].join(" ")}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        dir="ltr"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />

      {invalid && (
        <p className="mt-1 text-xs text-rose-500">
          فرمت کد اشتباه است.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => void handleRestore()} disabled={busy || !input.trim()}>
          {busy ? "در حال اتصال..." : "اتصال"}
        </Button>
        {input && (
          <Button variant="secondary" onClick={() => setInput("")}>
            پاک کردن
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backup code section (accordion-style, always at bottom)
// ---------------------------------------------------------------------------

function BackupCodeSection({
  code,
  onToast,
}: {
  code: string;
  onToast: (text: string, tone: ToastTone) => void;
}) {
  const [open, setOpen] = useState(false);

  const handleRotate = () => {
    const ok = window.confirm(
      "ساخت کد جدید باعث می‌شود دستگاه‌های قبلی دیگر به پروفایل فعلی وصل نباشند.\n\nادامه می‌دهی؟",
    );
    if (!ok) return;

    const next = rotateDeviceId();
    if (!next) {
      onToast("ساخت کد جدید انجام نشد. (مشکل در ذخیره‌سازی مرورگر)", "error");
      return;
    }

    window.location.reload();
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white">
      {/* Accordion toggle */}
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm text-zinc-600 hover:text-zinc-900"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>کد بازیابی (backup code)</span>
        <span
          className={[
            "text-zinc-400 transition-transform duration-200",
            open ? "rotate-180" : "",
          ].join(" ")}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="border-t border-zinc-100 px-4 pb-4 pt-3 space-y-3">
          <p className="text-xs text-zinc-500">
            این کد مخصوص توست. اگر localStorage مرورگر پاک شد یا دستگاه عوض
            کردی، با این کد می‌توانی به همین پروفایل برگردی. آن را در جای امن
            نگه دار.
          </p>

          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
            <code className="flex-1 select-all text-xs text-zinc-700" dir="ltr">
              {code}
            </code>
            <CopyPill
              value={code}
              label="کپی"
              dir="auto"
              className="shrink-0 rounded-lg py-1 text-xs"
            />
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
            <p className="text-xs text-amber-800">
              اگر فکر می‌کنی کد لو رفته، می‌تونی کد جدید بسازی — ولی دستگاه‌های
              قبلاً وصل‌شده جدا می‌شن.
            </p>
            <button
              type="button"
              className="mt-2 text-xs text-amber-700 underline underline-offset-2 hover:text-amber-900"
              onClick={handleRotate}
            >
              ساخت کد جدید
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export default function DeviceSyncButton() {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastCounter = useRef(0);

  const code = useMemo(() => getOrCreateDeviceId(), []);
  const syncUrl = useMemo(() => buildSyncUrl(code), [code]);

  // Reset internal state when modal opens
  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setToast(null);
  };

  const showToast = (text: string, tone: ToastTone = "success") => {
    toastCounter.current += 1;
    setToast({ id: toastCounter.current, text, tone });
  };

  return (
    <>
      <Button variant="secondary" onClick={handleOpen}>
        اتصال دستگاه جدید
      </Button>

      <PortalModal
        open={open}
        title="اتصال دستگاه‌ها"
        onClose={handleClose}
        maxWidthClass="max-w-lg"
      >
        {toast ? (
          <InlineToast
            toast={toast}
            onDone={() => setToast(null)}
          />
        ) : null}

        {/* Primary flow: share to a new device */}
        <SectionTitle>انتقال به دستگاه جدید</SectionTitle>
        <SectionDesc>
          QR را اسکن کن یا لینک را در دستگاه جدید باز کن تا همان پروفایل منتقل شود.
        </SectionDesc>

        <div className="mt-4">
          <ShareStep syncUrl={syncUrl} />
        </div>

        <Divider />

        {/* Secondary flow: restore on this device using a code */}
        <SectionTitle>این دستگاه را وصل کن</SectionTitle>
        <SectionDesc>
          اگر روی دستگاه جدید هستی و کد بازیابی داری، اینجا وارد کن.
        </SectionDesc>

        <div className="mt-4">
          <RestoreStep
            onSuccess={handleClose}
            onToast={showToast}
          />
        </div>

        <Divider />

        {/* Tertiary: backup code — collapsed by default */}
        <BackupCodeSection code={code} onToast={showToast} />
      </PortalModal>
    </>
  );
}
