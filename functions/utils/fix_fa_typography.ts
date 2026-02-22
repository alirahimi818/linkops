export function fixFaTypography(input: string): string {
  if (!input || typeof input !== "string") return "";

  let t = input.trim();

  // مرحله ۰: حذف یادداشت طول کاراکتر انتهایی (رایج در خروجی‌های LLM)
  t = t.replace(/\s*\(\s*\d+\s*(?:char|character)s?\s*\)\s*$/i, "").trim();

  const protectedParts: string[] = [];
  const protect = (s: string) => {
    protectedParts.push(s);
    return `__PROTECT_${protectedParts.length - 1}__`;
  };

  // حفاظت قوی‌تر: URL + @mention + #hashtag + هر چیزی داخل پرانتز انتهایی
  t = t.replace(/https?:\/\/\S+/gi, protect);
  t = t.replace(/[@#][^\s!@#$%^&*()[\]{}<>"',.?؛،:؛؟!]+/g, protect); // هشتگ/منشن تا اولین فاصله یا کاراکتر خاص

  // حفاظت اضافی برای هر پرانتز انتهایی که ممکن است باقی مانده باشد
  t = t.replace(/\s*\([^)]+\)\s*$/, protect);

  // حالا نرمال‌سازی حروف عربی → فارسی
  t = t
    .replace(/ك/g, "ک")
    .replace(/ي/g, "ی")
    .replace(/ى/g, "ی")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/إ|أ/g, "ا")
    .replace(/ـ/g, ""); // حذف تطویل

  // تمیز کردن فاصله‌های اضافی
  t = t.replace(/[ \t]{2,}/g, " ").trim();

  // اضافه کردن نیم‌فاصله (ZWNJ) — با دقت بیشتر
  // می / نمی + فعل
  t = t.replace(/\b(ن?می)\s+([آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی])\b/g, "$1\u200c$2");

  // ها / های بعد از کلمه فارسی (با بررسی اینکه قبلش حرف فارسی باشد)
  t = t.replace(/([آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی])\s*ها\b/g, "$1\u200cها");
  t = t.replace(/([آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی])\s*های\b/g, "$1\u200cهای");

  // ترین (فقط بعد از صفت‌های حداقل ۳ حرف)
  t = t.replace(/([آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی]{3,})\s*ترین\b/g, "$1\u200cترین");

  // اصلاحات واژگانی خاص
  t = t
    .replace(/\bهستهای\b/gi, "هسته‌ای")
    .replace(/آیت\s*الله/g, "آیت\u200cالله")
    .replace(/جمهوری\s*اسلامی/g, "جمهوری\u200cاسلامی")     // اختیاری، اگر زیاد استفاده می‌شود
    .replace(/تغییر\s*رژیم/g, "تغییر\u200cرژیم");

  // تمیز کردن نهایی فاصله‌ها
  t = t.replace(/[ \t]{2,}/g, " ").trim();

  // بازگرداندن بخش‌های حفاظت‌شده
  t = t.replace(/__PROTECT_(\d+)__/g, (_, idx) => protectedParts[Number(idx)] ?? "");

  return t;
}