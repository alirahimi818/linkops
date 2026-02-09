// frontend/src/components/home/SuggestLinkForm.tsx
import { useMemo, useState } from "react";

import Button from "../ui/Button";
import Input from "../ui/Input";
import Textarea from "../ui/Textarea";
import Alert from "../ui/Alert";

import { createSuggestion } from "../../lib/api";

// Keep consistent with admin utils (simple copy for public side)
function autoFixUrl(input: string): string {
  const s = String(input ?? "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function isValidAbsoluteHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);

    if (u.protocol !== "http:" && u.protocol !== "https:") return false;

    const host = u.hostname.trim();
    if (!host) return false;

    // Reject localhost (public suggestions should be real URLs)
    if (host === "localhost") return false;

    // If it's an IPv4 address, optionally reject
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      // Basic range check (0-255)
      const ok = host
        .split(".")
        .every((x) => {
          const n = Number(x);
          return Number.isInteger(n) && n >= 0 && n <= 255;
        });
      if (ok) return false; // reject IPs
    }

    // If hostname has no dot, it's likely invalid for public web
    // Allows something like "example.com" or "sub.example.com"
    if (!host.includes(".")) return false;

    // TLD should have at least 2 chars (e.g., .com, .de, .ir)
    const parts = host.split(".");
    const tld = parts[parts.length - 1] ?? "";
    if (tld.length < 2) return false;

    return true;
  } catch {
    return false;
  }
}

export default function SuggestLinkForm(props: {
  defaultUrl?: string;
  onSuccess?: () => void;
}) {
  const [url, setUrl] = useState(props.defaultUrl ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fixedUrl = useMemo(() => autoFixUrl(url), [url]);
  const urlOk = useMemo(() => isValidAbsoluteHttpUrl(fixedUrl), [fixedUrl]);

  async function submit() {
    setError(null);

    const u = autoFixUrl(url);
    if (u !== url) setUrl(u);

    if (!u.trim() || !isValidAbsoluteHttpUrl(u)) {
      setError("لطفاً لینک را کامل وارد کنید (با http:// یا https://).");
      return;
    }

    setSaving(true);
    try {
      await createSuggestion({
        url: u.trim(),
        title: title.trim() || undefined,
        description: description.trim() || undefined,
      });

      // reset fields
      setTitle("");
      setDescription("");

      props.onSuccess?.();
    } catch (e: any) {
      // Match your backend error pattern
      if (e?.status === 409 && e?.data?.code === "DUPLICATE_URL") {
        setError("این لینک قبلاً در سیستم ثبت شده است.");
      } else if (
        e?.status === 409 &&
        e?.data?.code === "DUPLICATE_SUGGESTION"
      ) {
        setError("این لینک همین الان در صف بررسی است. 🙏");
      } else if (e?.status === 400 && e?.data?.code === "INVALID_URL") {
        setError("لینک نامعتبر است. لطفاً یک لینک کامل وارد کنید.");
      } else {
        setError(e?.message ?? "ثبت پیشنهاد ناموفق بود.");
      }
    } finally {
      setSaving(false);
    }
  }

  const disabled = saving || !url.trim() || !urlOk;

  return (
    <div className="grid gap-3">
      {error ? (
        <Alert variant="error" className="mb-1">
          {error}
        </Alert>
      ) : null}

      <Input dir="ltr" value={url} onChange={setUrl} placeholder="لینک (URL)" />

      <Input value={title} onChange={setTitle} placeholder="عنوان (اختیاری)" />

      <Textarea
        dir="auto"
        value={description}
        onChange={setDescription}
        placeholder="توضیح کوتاه (اختیاری)"
      />

      <div className="flex items-center justify-between gap-3">
        <Button variant="success" onClick={submit} disabled={disabled}>
          {saving ? "در حال ارسال…" : "ارسال پیشنهاد"}
        </Button>

        <div className="text-xs text-zinc-500">
          {url.trim() && !urlOk ? "فرمت لینک درست نیست." : " "}
        </div>
      </div>
    </div>
  );
}
