import Button from "../ui/Button";

type Props = {
  candidates: string[];
  maxPreview?: number;
  onAddAll: () => void;
  onClear: () => void;
};

export default function BulkCommentImport({
  candidates,
  maxPreview = 5,
  onAddAll,
  onClear,
}: Props) {
  if (!candidates || candidates.length < 2) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <div className="mb-2 text-xs text-zinc-600">
        {candidates.length} کامنت از متن تشخیص داده شد (بر اساس آیتم‌های لیستی).
      </div>

      <div className="max-h-40 overflow-auto rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-700">
        {candidates.slice(0, maxPreview).map((t, i) => (
          <div key={i} className="mb-2">
            <div className="font-mono" dir="ltr">
              {t}
            </div>
          </div>
        ))}
        {candidates.length > maxPreview ? (
          <div className="text-zinc-500">
            … و {candidates.length - maxPreview} مورد دیگر
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="info" onClick={onAddAll}>
          افزودن دسته‌جمعی
        </Button>
        <Button variant="secondary" onClick={onClear}>
          پاک کردن باکس
        </Button>
      </div>
    </div>
  );
}
