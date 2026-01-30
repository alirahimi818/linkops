<p align="center">
  <img src="./frontend/public/assets/flags/flag-ir-640.png" alt="Iran flag" width="480" />
</p>

<p align="center"><a href="#persian">فارسی</a></p>

# togetherForIran — Campaign-driven actions for Iranian freedom

A campaign-driven web app that presents short, daily actions for volunteers to perform on social media — links, suggested comments, hashtags and quick checks to help coordinate effective, focused campaigns.

---

## How it works
- Public users see a simple dashboard and daily lists of suggested actions (links, suggested text, and hashtags). They can copy text, check hashtags, and open external campaign links.
- The app is a Progressive Web App (PWA) so volunteers can install it on their phones and use it offline for certain features.
- Personal user choices like marking an action as "done" are stored locally in the browser (localStorage) — nothing personal is uploaded to the server by the user-facing UI.

## Admin vs Public
- Public (no login): Browse the dashboard, view per-day items, use the hashtag checker, and copy suggested text. No personal data is required.
- Admin (requires login): A protected admin panel allows admins to create/edit items, add comments, manage actions and the hashtag whitelist, and manage users. Admin access uses authenticated requests (JWT tokens).

## Privacy & hosting
- User state (what you mark done/later/hidden) stays on your device in the browser; the server does not store individual users' checkmarks.
- Admin-created content (items, hashtags, comments, users) is stored in the D1 database used by the server side.
- The whole service (frontend and serverless API) is hosted on Cloudflare Pages and uses Cloudflare D1 for the database.

## Technology (short)
- Frontend: React + TypeScript, Vite, Tailwind CSS, and a PWA plugin.
- Backend: Cloudflare Pages Functions (serverless) and D1 database.
- Auth & security: Admin passwords are PBKDF2-hashed on creation; admin sessions use signed JWTs.

## Quick start (developer)
1. Frontend dev:
   - cd `frontend`
   - npm install
   - npm run dev
2. For full-stack/dev with functions and D1, use Cloudflare Pages / Wrangler tooling and configure the `DB` binding and `JWT_SECRET` environment variable.

## Contributing
- Fork, create a branch, and open a pull request. Keep changes small and focused.
- Run the frontend linter and build before submitting:
  - `cd frontend && npm run lint`
  - `cd frontend && npm run build`
- Good first contributions: documentation, UI polish, PWA/offline improvements, tests, or helping expand campaign content.

---

<a id="persian"></a>
## نسخه فارسی: باهم برای ایران

این پروژه یک وب‌سایت کمپین‌محور است که هر روز فعالیت‌های کوتاه و هدفمند برای کاربران نمایش می‌دهد تا در شبکه‌های اجتماعی مشارکت کنند (لینک‌ها، متن پیشنهادی، هشتگ‌ها و ابزار بررسی هشتگ).

## نحوه کار
- کاربران عمومی می‌توانند داشبورد را ببینند، لیست فعالیت‌های روز را مرور کنند، متن‌ها را کپی کنند و هشتگ‌ها را بررسی کنند.
- این برنامه یک PWA است و برخی قابلیت‌ها در حالت آفلاین محدود کار می‌کنند.
- وضعیت‌هایی که کاربر برای یک آیتم تنظیم می‌کند (انجام‌شده / بعداً / مخفی) تنها در مرورگر ذخیره می‌شود (localStorage) و به سرور ارسال نمی‌شود.

## بخش ادمین
- پنل ادمین نیاز به ورود دارد و برای ایجاد/ویرایش آیتم‌ها، مدیریت کامنت‌ها، تعریف اکشن‌ها و مدیریت وایت‌لیست هشتگ استفاده می‌شود.
- ادمین‌ها با نام‌کاربری و رمز عبور وارد می‌شوند؛ پس از ورود یک توکن JWT صادر شده و برای درخواست‌های محافظت‌شده استفاده می‌شود.

## حریم خصوصی و میزبانی
- هیچ‌گونه اطلاعات شخصی از کاربران عمومی ذخیره یا ارسال نمی‌شود؛ فقط محتوای ادمین‌ها در پایگاه داده (D1) نگهداری می‌شود.
- کل سرویس (فرانت‌اند و API سرورلس) روی Cloudflare Pages میزبانی می‌شود و پایگاه داده در Cloudflare D1 قرار دارد.

## فناوری‌ها
- فرانت‌اند: React + TypeScript، Vite، Tailwind CSS و پشتیبانی PWA.
- بک‌اند: Cloudflare Pages Functions و D1.
- امنیت: رمزهای عبور با PBKDF2-SHA256 هش شده و توکن‌ها با HMAC-SHA256 امضا می‌شوند.

## شروع سریع (توسعه)
- `cd frontend && npm install && npm run dev`
- برای کار با توابع و D1 از Cloudflare Pages / Wrangler استفاده کنید و binding `DB` و متغیر محیطی `JWT_SECRET` را تنظیم نمایید.


## مشارکت
- فورک کنید، روی یک شاخه جدید تغییر دهید و PR ارسال کنید. مشارکت‌هایی مانند مستندسازی، بهبود UI، تست‌ها و محتوا بسیار مفید هستند.

