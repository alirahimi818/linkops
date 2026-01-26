import { useOnlineStatus } from "../../lib/useOnlineStatus";

export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="sticky top-0 z-40 w-full border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
      شما آفلاین هستید. بعضی قابلیت‌ها ممکن است کار نکنند.
    </div>
  );
}
