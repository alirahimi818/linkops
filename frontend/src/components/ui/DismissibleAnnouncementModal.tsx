import { useEffect, useMemo, useState } from "react";
import Button from "./Button";
import Card from "./Card";

import {
  dismissAnnouncement,
  isAnnouncementDismissed,
} from "../../lib/announcementStore";

type Props = {
  /**
   * Unique id for this announcement (e.g. "welcome-2026-01")
   * Changing this will show it again.
   */
  id: string;

  /**
   * Separate per-page scope. Usually pass the route like "/admin" or "home".
   * If you want it global across app, use a constant like "global".
   */
  scopeKey: string;

  title: string;
  description?: string;

  /**
   * Optional image url (local or remote)
   */
  imageUrl?: string;

  /**
   * Optional: show even if dismissed (for debugging/admin)
   */
  forceShow?: boolean;

  /**
   * Optional: extra content (e.g. list, links, buttons)
   */
  children?: React.ReactNode;
};

export default function DismissibleAnnouncementModal(props: Props) {
  const [open, setOpen] = useState(false);

  const shouldShow = useMemo(() => {
    if (props.forceShow) return true;
    return !isAnnouncementDismissed(props.scopeKey, props.id);
  }, [props.forceShow, props.scopeKey, props.id]);

  useEffect(() => {
    if (shouldShow) setOpen(true);
  }, [shouldShow]);

  function close() {
    dismissAnnouncement(props.scopeKey, props.id);
    setOpen(false);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }

    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={props.title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={close}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg">
        <Card className="p-5 sm:p-6">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-zinc-900">
              {props.title}
            </div>
            {props.description ? (
              <div className="mt-1 text-sm text-zinc-600" dir="auto">
                {props.description}
              </div>
            ) : null}
          </div>

          {props.imageUrl ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
              <img
                src={props.imageUrl}
                alt={props.title}
                className="h-auto w-full object-cover"
                loading="lazy"
              />
            </div>
          ) : null}

          {props.children ? <div className="mt-4">{props.children}</div> : null}

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button variant="success" onClick={close}>
              بستن
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
