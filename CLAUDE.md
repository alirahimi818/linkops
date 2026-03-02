# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**togetherForIran** — A campaign-driven PWA that presents daily actions (links, suggested comments, hashtags) for volunteers to perform on social media to support Iranian freedom. Hosted on Cloudflare Pages with a D1 database.

## Commands

All frontend commands run from the `frontend/` directory:

```bash
cd frontend
npm install          # install deps
npm run dev          # start Vite dev server
npm run build        # tsc -b && vite build
npm run lint         # ESLint
npm run preview      # preview production build
```

There is no separate build step for `functions/` — Cloudflare Pages handles TypeScript functions directly. To run the full stack locally you need Wrangler with the `DB` binding and `JWT_SECRET` env var configured.

**Dev proxy**: `vite.config.ts` proxies `/api/*` to `https://together-for-iran.com` (the live production API), so `npm run dev` works for frontend-only development without a local Cloudflare environment.

## Architecture

### Frontend (`frontend/src/`)

React 19 + TypeScript SPA, Vite bundler, Tailwind CSS v4, PWA via vite-plugin-pwa/workbox.

**Routing** (`main.tsx`): React Router v7 with these pages:
- `/` — Home (public, daily campaign items)
- `/todos` — Todo list view
- `/hashtags-checker` — Hashtag verification tool
- `/login` — Admin login
- `/admin` — Admin panel (roles: `superadmin`, `admin`, `editor`)
- `/superadmin` — SuperAdmin panel (role: `superadmin` only)

**Key libs** (`frontend/src/lib/`):
- `api.ts` — All client-side API calls. Public endpoints pass `X-Device-Id`; admin endpoints pass Bearer token from `localStorage("admin:jwt")`.
- `device.ts` — Gets/creates the stable device UUID (`device_id_v1` in localStorage).
- `deviceSync.ts` — Cross-device sync via QR code: builds sync URLs with `?device_id=` param, applies device IDs from URL on load.
- `statusStore.ts` — Used to be the status store (localStorage), now just a local event emitter.
- `statusMigration.ts` — One-time migration of legacy localStorage status entries to the server API.
- `loadingStore.ts` — Global loading overlay state, updated automatically by `api.ts`.

**Components** are organized in `frontend/src/components/`:
- `home/` — Home page components (ItemList, CategoryGrid, DeviceSyncButton, etc.)
- `layout/` — PageShell, TopBar
- `ops/` — Admin operation components (CommentsEditor, AICommentsModal, SuperAdmin* panels, etc.)
- `ui/` — Reusable primitives (Button, Card, Input, Tabs, Alert, etc.)

### Backend (`functions/`)

Cloudflare Pages Functions — file path = API route. TypeScript files are deployed as-is.

**Conventions**:
- Files/dirs prefixed with `_` are helpers, not route handlers: `_middleware.ts`, `api/_device.ts`, `api/_rate_limit.ts`, `api/admin/_auth.ts`
- `_middleware.ts` (root) runs on every request: CORS (via `ALLOWED_ORIGINS` env), device upsert enforcement, and security headers (HSTS, CSP, etc.)

**API structure**:
```
functions/
  _middleware.ts          # global middleware
  api/
    _device.ts            # requireDeviceId() helper
    _rate_limit.ts        # device-based rate limiter (D1-backed)
    items.ts              # GET /api/items
    items/
      feed.ts             # GET /api/items/feed
      summary.ts          # GET /api/items/summary
    status/
      set.ts              # POST /api/status/set
    categories.ts         # GET /api/categories
    hashtags.ts           # GET /api/hashtags
    actions.ts            # GET /api/actions
    suggestions.ts        # POST /api/suggestions
    admin/
      _auth.ts            # JWT sign/verify, PBKDF2 password hashing, requireAuth()
      login.ts            # POST /api/admin/login
      me.ts               # GET/PATCH /api/admin/me
      items.ts            # CRUD /api/admin/items
      categories.ts       # CRUD /api/admin/categories
      hashtags.ts         # CRUD /api/admin/hashtags
      actions.ts          # CRUD /api/admin/actions
      users.ts            # CRUD /api/admin/users (superadmin only)
      item-comments.ts    # CRUD /api/admin/item-comments
      suggestions/        # Admin suggestion moderation
      ai/
        generate-comments.ts   # AI comment generation
      x/
        autofill.ts       # X/Twitter URL autofill via AI
  _lib/
    ai/
      provider.ts         # AI provider selection (Cloudflare Workers AI or xAI)
      runner.ts           # AI call runner
      providers/          # cloudflare.ts, xai.ts
      prompts/            # Prompt templates (draft_en, translate_to_fa, fetch_x_context, etc.)
```

### Database (Cloudflare D1)

Key tables:
- `items` — Campaign items with `date`, `title`, `url`, `url_norm`, `description`, `category_id`, `is_global`, `created_by_user_id`
- `item_comments` — Suggested comments with `text`, `translation_text`, `author_type` (`admin`|`ai`|role), `author_id`
- `item_actions` — Many-to-many join between items and actions
- `item_status` — Per-device item status: `device_id + item_id` → `status` (`todo`|`later`|`done`|`hidden`)
- `devices` — Device registry, upserted on every public API call
- `rate_limits` — D1-backed rate limiter, keyed by `dev:{deviceId}:{action}`
- `users` — Admin users with PBKDF2-hashed passwords and roles
- `categories`, `actions`, `hashtag_whitelist` — Reference data

**`is_global` items** appear on all dates alongside date-specific items. URL deduplication uses `url_norm` (normalizes x.com/twitter.com, Instagram, strips tracking params).

### Auth & Security

- **Public API** requires `X-Device-Id` header (UUID v4) on all `/api/*` except `/api/admin/*`
- **Admin API** requires `Authorization: Bearer <JWT>` (HMAC-SHA256 signed, default 7-day TTL)
- **Passwords**: PBKDF2-SHA256, 100k iterations, stored as `pbkdf2$<iter>$<salt>$<hash>`
- **Roles**: `superadmin` > `admin` > `editor`. DELETE on items restricted to `superadmin`+`admin`.
- **CORS**: Controlled via `ALLOWED_ORIGINS` env var (comma-separated)

### Environment Variables

| Variable | Description |
|---|---|
| `DB` | Cloudflare D1 binding |
| `JWT_SECRET` | JWT signing secret (required) |
| `JWT_TTL_SECONDS` | JWT expiry in seconds (default: 604800 = 7 days) |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowed origins |

### Device Sync

Volunteers can transfer their device ID to another browser/device via QR code. `deviceSync.ts` builds a URL with `?device_id=<uuid>`, and on load `tryApplyDeviceIdFromUrl()` applies the ID and cleans the URL. This migrates server-side item status (done/later/hidden) to the new device automatically.
