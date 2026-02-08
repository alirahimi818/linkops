// frontend/src/components/home/SuggestLinkButton.tsx
import { useEffect, useState } from "react";

import Button from "../ui/Button";
import Alert from "../ui/Alert";
import PortalModal from "../ui/PortalModal";
import SuggestLinkForm from "./SuggestLinkForm";


export default function SuggestLinkButton(props: { defaultUrl?: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) setDone(false);
  }, [open]);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        پیشنهاد لینک
      </Button>

      <PortalModal
        open={open}
        title="پیشنهاد لینک جدید"
        onClose={() => setOpen(false)}
        maxWidthClass="max-w-xl"
      >
        {done ? (
          <Alert variant="success" className="mb-3">
            پیشنهادت ثبت شد و بعد از بررسی به لیست اضافه می‌شه. 🙌
          </Alert>
        ) : (
          <Alert variant="warning" className="mb-3 text-right">
            لینک، عنوان (اختیاری) و توضیح کوتاه (اختیاری) رو وارد کن. بعد از
            بررسی به لیست اضافه می‌شه.
          </Alert>
        )}

        <SuggestLinkForm
          defaultUrl={props.defaultUrl}
          onSuccess={() => setDone(true)}
        />

        <div className="mt-3 text-xs text-zinc-500">
          نکته: هر یک دقیقه یکبار میشه لینک جدید ثبت کرد.
        </div>
      </PortalModal>
    </>
  );
}
