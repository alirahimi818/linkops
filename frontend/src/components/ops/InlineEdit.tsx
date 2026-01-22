import { useState } from "react";
import Button from "../ui/Button";
import Input from "../ui/Input";

type Props = {
  value: string;
  onSave: (next: string) => Promise<void>;
  placeholder?: string;
  maxLen?: number;
};

export default function InlineEdit(props: Props) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(props.value);
  const [saving, setSaving] = useState(false);

  async function save() {
    const next = v.trim();
    if (!next) return;

    setSaving(true);
    try {
      await props.onSave(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <div className="min-w-0 truncate">{props.value}</div>
        <Button variant="ghost" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-full max-w-sm">
        <Input value={v} onChange={setV} placeholder={props.placeholder ?? ""} />
      </div>
      <Button variant="secondary" onClick={save} disabled={saving || !v.trim() || (props.maxLen ? v.trim().length > props.maxLen : false)}>
        Save
      </Button>
      <Button variant="ghost" onClick={() => { setEditing(false); setV(props.value); }} disabled={saving}>
        Cancel
      </Button>
    </div>
  );
}
