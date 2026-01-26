import { useEffect, useMemo, useState } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Alert from "../ui/Alert";

import { usePwaInstallPrompt } from "../../lib/usePwaInstallPrompt";
import { useOnlineStatus } from "../../lib/useOnlineStatus";
import {
  dismissAnnouncement,
  isAnnouncementDismissed,
} from "../../lib/announcementStore";
import {
  bumpVisits,
  getVisits,
  dismissForDays,
  isDismissedByTime,
} from "../../lib/pwaNudges";

type Msg = { type: "success" | "error" | "info"; text: string };

export default function InstallPwaCard(props: {
  scopeKey?: string; // default: "/"
  id?: string; // default: "pwa-install"
  minVisits?: number; // default: 2
  minSecondsOnPage?: number; // default: 30
}) {
  const scopeKey = props.scopeKey ?? "/";
  const id = props.id ?? "pwa-install";
  const minVisits = props.minVisits ?? 2;
  const minSecondsOnPage = props.minSecondsOnPage ?? 30;

  const online = useOnlineStatus();
  const { state, promptInstall } = usePwaInstallPrompt();
  const [dismissedNow, setDismissedNow] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [busy, setBusy] = useState(false);
  const [timeGateOpen, setTimeGateOpen] = useState(false);

  const dismissed = useMemo(
    () => isAnnouncementDismissed(scopeKey, id),
    [scopeKey, id],
  );
  const dismissedByTime = useMemo(() => isDismissedByTime(), []);

  // Count visits once per mount
  useEffect(() => {
    bumpVisits();
  }, []);

  // Open time gate after minSecondsOnPage
  useEffect(() => {
    const t = window.setTimeout(
      () => setTimeGateOpen(true),
      minSecondsOnPage * 1000,
    );
    return () => window.clearTimeout(t);
  }, [minSecondsOnPage]);

  const visitsOk = useMemo(() => getVisits() >= minVisits, [timeGateOpen]); // re-eval after time gate
  const gateOk = visitsOk || timeGateOpen;

  const shouldShow = useMemo(() => {
    if (dismissed) return false;
    if (dismissedByTime) return false;
    if (state.isInstalled) return false;

    // Show only when installable or iOS instructions apply
    const installRelevant = state.canPrompt || state.isIOSAddToHome;
    if (!installRelevant) return false;

    // Gate: visits/time
    if (!gateOk) return false;

    return true;
  }, [
    dismissed,
    dismissedByTime,
    state.isInstalled,
    state.canPrompt,
    state.isIOSAddToHome,
    gateOk,
  ]);

  if (!shouldShow) return null;
  if (dismissedNow) return null;

  async function onInstall() {
    setMsg(null);
    setBusy(true);

    const r = await promptInstall();

    setBusy(false);

    if (r === "accepted") {
      setMsg({
        type: "success",
        text: "نصب شروع شد. اگر پنجره‌ای باز شد، تایید کنید.",
      });
      // Hide for a while if user accepted (avoid repeated prompts)
      dismissForDays(14);
    } else if (r === "dismissed") {
      setMsg({
        type: "info",
        text: "فعلاً نصب را رد کردید. بعداً هم می‌توانید نصب کنید.",
      });
      // Snooze for a few days
      dismissForDays(3);
    } else {
      setMsg({
        type: "error",
        text: "امکان نصب در این مرورگر/حالت وجود ندارد.",
      });
    }
  }

  function onDismissForever() {
    dismissAnnouncement(scopeKey, id);
    setDismissedNow(true);
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-base font-semibold text-zinc-900">
              نصب اپ (PWA)
            </div>

            <span
              className={[
                "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                online
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200",
              ].join(" ")}
              title={online ? "Online" : "Offline"}
            >
              {online ? "آنلاین" : "آفلاین"}
            </span>
          </div>

          <div className="mt-1 text-sm text-zinc-600" dir="auto">
            اگر دوست داری، می‌توانی این ابزار رو مثل یک اپ روی گوشی نصب کنی تا
            سریع‌تر باز بشه.در ضمن این برنامه نیازی به لاگین و اطلاعات شخصی شما
            نداره و فعالیت‌هایی کع انجام میدی، به کلی روی گوشی خودت ذخیره میشه
          </div>

          {!online ? (
            <div className="mt-2 text-xs text-zinc-500">
              در حالت آفلاین، فقط بخش‌های کش‌شده کار می‌کنند (عکس‌ها و فایل‌های
              اپ). API ممکن است در دسترس نباشد.
            </div>
          ) : null}
        </div>
      </div>

      {msg ? (
        <div className="mt-3">
          <Alert
            variant={
              msg.type === "success"
                ? "success"
                : msg.type === "info"
                  ? "info"
                  : "error"
            }
          >
            {msg.text}
          </Alert>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {state.canPrompt ? (
          <Button variant="success" onClick={onInstall} disabled={busy}>
            {busy ? "در حال آماده‌سازی…" : "نصب اپ"}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onDismissForever}>
          دیگه نشون نده
        </Button>
        {state.isIOSAddToHome ? (
          <div className="text-sm text-zinc-700" dir="rtl">
            iOS: در Safari روی <span className="font-medium">Share</span> بزنید
            و <span className="font-medium">Add to Home Screen</span> را انتخاب
            کنید.
          </div>
        ) : null}
      </div>
    </Card>
  );
}
