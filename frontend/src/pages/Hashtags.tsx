import { useEffect, useMemo, useState } from "react";

import PageShell from "../components/layout/PageShell";
import TopBar from "../components/layout/TopBar";
import Card from "../components/ui/Card";
import Textarea from "../components/ui/Textarea";
import ActionPill from "../components/ui/ActionPill";
import { IconPaste } from "../components/ui/icons";

import { fetchHashtagWhitelist } from "../lib/api";
import type { HashtagWhitelistRow } from "../lib/api";

import { validateHashtags } from "../lib/hashtags";
import HashtagInspector from "../components/ops/HashtagInspector";
import MyHashtags from "../components/ops/MyHashtags";
import PriorityTags from "../components/ops/PriorityTags";
import { copyText } from "../lib/clipboard";
import DismissibleAnnouncementModal from "../components/ui/DismissibleAnnouncementModal";

export default function HashtagsPage() {
  const [rows, setRows] = useState<HashtagWhitelistRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [whitelist, setWhitelist] = useState<Set<string>>(new Set());

  const [text, setText] = useState("");

  const hasText = text.trim().length > 0;

  const issuesCount = useMemo(() => {
    if (!hasText || whitelist.size === 0) return 0;
    return validateHashtags(text, whitelist).length;
  }, [hasText, text, whitelist]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const rows = (await fetchHashtagWhitelist()) as HashtagWhitelistRow[];

        const active = (rows ?? [])
          .filter((t) => t.is_active === 1)
          .map((t) => String(t.tag ?? "").trim())
          .filter(Boolean);

        if (!alive) return;
        setWhitelist(new Set(active));
        setRows(rows ?? []);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function pasteFromClipboard() {
    try {
      const v = await navigator.clipboard.readText();
      if (v) setText(v);
    } catch {
      // ignore permission issues
    }
  }

  async function copyCurrentText() {
    if (!hasText) return;
    await copyText(text);
  }

  function clearText() {
    setText("");
  }

  function autoFixAll() {
    if (!hasText || whitelist.size === 0) return;
    const issues = validateHashtags(text, whitelist);

    // Use the same safe replacer logic by delegating to Inspector through setText,
    // but we don't have access to its internal helper. So re-implement here:
    let out = text;

    const escapeRegExp = (s: string) =>
      s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const i of issues) {
      const sugg = String((i as any).suggestion ?? "").trim();
      const raw = String((i as any).raw ?? "").trim();
      if (!sugg || !raw) continue;

      const from = raw.startsWith("#") ? raw : `#${raw}`;
      const to = `#${sugg}`;
      const re = new RegExp(`${escapeRegExp(from)}(?![\\p{L}\\p{N}_])`, "gu");
      out = out.replace(re, to);
    }

    setText(out);
  }

  function appendToText(tagsText: string) {
    setText((prev) => {
      const base = String(prev ?? "");
      if (!base.trim()) return tagsText;
      return `${base}\n${tagsText}`;
    });
  }

  return (
    <PageShell dir="rtl">
      {loading ? (
        <div className="text-zinc-500">در حال بارگذاری…</div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-3">
            <TopBar
              dir="rtl"
              title="بررسی هشتگ‌ها"
              subtitle="متن را وارد کنید تا هشتگ‌های ناشناخته/اشتباه مشخص شوند."
            />

            {/* Action row */}
            <div className="flex flex-wrap items-center justify-between md:justify-start gap-1 border-t pt-3 border-zinc-200">
              <ActionPill
                title="Paste از کلیپ‌بورد"
                onClick={pasteFromClipboard}
                icon={<IconPaste className="h-4 w-4" />}
                successKey="paste"
              >
                چسباندن
              </ActionPill>

              <ActionPill
                title="کپی کل متن"
                onClick={copyCurrentText}
                successKey="copyText"
                className={!hasText ? "opacity-50 pointer-events-none" : ""}
              >
                کپی متن
              </ActionPill>

              <ActionPill
                title="جایگزینی خودکار پیشنهادها"
                onClick={autoFixAll}
                successKey="fix"
                className={
                  !hasText || whitelist.size === 0
                    ? "opacity-50 pointer-events-none"
                    : ""
                }
              >
                جایگزینی خودکار
              </ActionPill>

              <ActionPill
                title="پاک کردن متن"
                onClick={clearText}
                successKey="clear"
                className={!hasText ? "opacity-50 pointer-events-none" : ""}
              >
                پاک کردن
              </ActionPill>
            </div>
          </div>
          <Card>
            {/* small status */}
            <div className="ms-auto text-left mb-1 text-xs text-zinc-500">
              {loading
                ? "در حال بارگذاری وایت‌لیست…"
                : whitelist.size
                  ? `وایت‌لیست: ${whitelist.size}`
                  : "وایت‌لیست خالی است"}
              {hasText ? (
                <span className="ms-2">
                  • ایرادها:{" "}
                  <span
                    className={
                      issuesCount
                        ? "text-red-700 font-medium"
                        : "text-emerald-700 font-medium"
                    }
                  >
                    {issuesCount}
                  </span>
                </span>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Textarea
                dir="auto"
                value={text}
                onChange={setText}
                placeholder="متن را اینجا وارد کنید…"
                rows={10}
              />
              {text.length > 0 ? (
                <div
                  className={[
                    "text-xs text-left",
                    text.length > 280 ? "text-red-600" : "text-green-600",
                  ].join(" ")}
                >
                  تعداد کاراکترها: {text.length}
                </div>
              ) : (
                ""
              )}

              {!hasText ? (
                <div className="text-sm text-zinc-500">
                  نکته: می‌توانید از دکمه{" "}
                  <span className="font-medium">چسباندن</span> استفاده کنید و
                  بعد ایرادها را ببینید.
                </div>
              ) : null}
            </div>
          </Card>

          {/* Inspector shows issues + whitelist toggle + copy tags */}
          <HashtagInspector
            title="نتیجه بررسی"
            text={text}
            whitelist={whitelist}
            onReplaceText={setText}
          />

          <MyHashtags onAppendToText={appendToText} />

          <PriorityTags
            title="اولویت هشتگ‌ها"
            rows={(rows as any) ?? []}
            maxItems={30}
          />

          <DismissibleAnnouncementModal
            scopeKey="/"
            id="hashtags-2026-01"
            title="راهنمای سریع"
            description="توی این بخش می‌تونی هشتگ‌های متن خودت رو بررسی کنی و مطمئن شی که از هشتگ‌های درست و مرتبط استفاده می‌کنی. همچنین می‌تونی هشتگ‌های شخصی خودت رو ذخیره کنی، خیلی راحت به متن اضافه‌شون کنی و در نهایت اولویت و ترتیب پیشنهادی هشتگ‌ها رو هم ببینی."
            imageUrl="/assets/hashtag-background.jpg"
          />
        </div>
      )}
    </PageShell>
  );
}
