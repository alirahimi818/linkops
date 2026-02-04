import Button from "../ui/Button";

type Props = {
  cleaned: string | null;
  original: string;
  onApply: (next: string) => void;
};

export default function CleanSinglePasteHint({
  cleaned,
  original,
  onApply,
}: Props) {
  if (!cleaned) return null;
  if (cleaned === original.trim()) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <div className="mb-2 text-xs text-zinc-600">
        متن شما قابل پاکسازی است (تبدیل به یک خط و چسباندن منشن‌ها).
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="info" onClick={() => onApply(cleaned)}>
          پاکسازی متن
        </Button>
      </div>
    </div>
  );
}
