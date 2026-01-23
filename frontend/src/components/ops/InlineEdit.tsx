import { useEffect, useState, type JSX } from "react";
import Button from "../ui/Button";

type Props<T> = {
  value: T;
  onSave: (next: T) => Promise<void>;

  /**
   * Render when not editing (defaults to String(value)).
   */
  renderDisplay?: (value: T) => JSX.Element;

  /**
   * Render editor UI. You get draft + setter.
   */
  renderEditor: (draft: T, setDraft: (v: T) => void) => JSX.Element;

  /**
   * Validate draft before save. Return string message to block save.
   */
  validate?: (draft: T) => string | null;

  /**
   * Labels
   */
  editLabel?: string;
  saveLabel?: string;
  cancelLabel?: string;

  /**
   * Disable editing completely
   */
  disabled?: boolean;

  /**
   * Optional external className
   */
  className?: string;

  /**
   * Layout direction
   */
  dir?: "rtl" | "ltr"; // default: rtl
};

export default function InlineEdit<T>(props: Props<T>) {
  const dir = props.dir ?? "rtl";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<T>(props.value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setDraft(props.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);

  async function save() {
    setError(null);

    const msg = props.validate ? props.validate(draft) : null;
    if (msg) {
      setError(msg);
      return;
    }

    setSaving(true);
    try {
      await props.onSave(draft);
      setEditing(false);
    } catch (e: any) {
      setError(e?.message ?? "ذخیره ناموفق بود.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setError(null);
    setDraft(props.value);
    setEditing(false);
  }

  function startEdit() {
    if (props.disabled) return;
    setEditing(true);
  }

  if (!editing) {
    return (
      <div dir={dir} className={`flex items-center gap-2 ${dir === "rtl" ? "text-right" : "text-left"} ${props.className ?? ""}`}>
        <Button variant="ghost" onClick={startEdit} disabled={props.disabled}>
          {props.editLabel ?? "ویرایش"}
        </Button>

        <div className="min-w-0 truncate">
          {props.renderDisplay ? props.renderDisplay(props.value) : <span>{String(props.value)}</span>}
        </div>
      </div>
    );
  }

  return (
    <div dir={dir} className={`grid gap-2 ${dir === "rtl" ? "text-right" : "text-left"} ${props.className ?? ""}`}>
      <div className={`flex flex-wrap items-center gap-2 ${dir === "rtl" ? "flex-row-reverse" : ""}`}>
        {props.renderEditor(draft, setDraft)}

        <Button variant="secondary" onClick={save} disabled={saving || props.disabled}>
          {props.saveLabel ?? (saving ? "در حال ذخیره…" : "ذخیره")}
        </Button>

        <Button variant="ghost" onClick={cancel} disabled={saving}>
          {props.cancelLabel ?? "انصراف"}
        </Button>
      </div>

      {error ? (
        <div className="text-xs text-red-700" role="alert" aria-live="polite">
          {error}
        </div>
      ) : null}
    </div>
  );
}
