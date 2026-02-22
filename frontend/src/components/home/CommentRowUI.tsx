import { useState } from "react";
import Button from "../ui/Button";
import CopyPill from "../ui/CopyPill";

export default function CommentRowUI(props: {
  text: string;
  translation: string | null;
  url: string;
  xEnabled: boolean;
  onOpenTweet: (t: string) => void;
  onOpenReply: (url: string, t: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {/* Original text */}
      <div
        className="min-w-0 whitespace-pre-wrap text-sm text-zinc-800"
        dir="auto"
      >
        {props.text}
      </div>

      {/* Translation (collapsed by default, only if exists) */}
      {props.translation ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full px-3 py-2 text-right text-xs font-medium text-blue-500 hover:bg-zinc-100 transition rounded-xl"
          >
            {open ? "بستن ترجمه" : "نمایش ترجمه ماشین"}
          </button>

          {open ? (
            <div className="px-3 pb-3">
              <div
                className="whitespace-pre-wrap text-sm text-zinc-700"
                dir="rtl"
              >
                {props.translation}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Actions must use ORIGINAL text */}
      <div className="flex flex-wrap items-center gap-2 justify-around md:justify-start border-t pt-3 border-zinc-200">
        <CopyPill
          value={props.text}
          label="کپی"
          dir="auto"
          className="rounded-xl py-2 text-sm"
        />

        {props.xEnabled ? (
          <>
            <Button
              className="text-xs"
              variant="secondary"
              onClick={() => props.onOpenTweet(props.text)}
              title="ساخت توییت با این متن"
            >
              توییت
            </Button>

            <Button
              className="text-xs"
              variant="secondary"
              onClick={() => props.onOpenReply(props.url, props.text)}
              title={
                props.xEnabled
                  ? "ریپلای به همان توییت"
                  : "این لینک استتوس نیست، به توییت معمولی می‌رود"
              }
            >
              ریپلای
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
