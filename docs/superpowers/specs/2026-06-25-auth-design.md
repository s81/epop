# Auth Design — e-pop MES
**Date:** 2026-06-25  
**Status:** Approved

## Overview

Add authentication and role-based access control to protect `/admin/*` and `/orders/*`. The shop-floor tablet (`/tablet/*`) stays open — operators identify themselves per-action via badge ID, not login. Six named users across three roles; sessions via signed JWT cookie; no external auth service.

---

## Roles

| Role | Permissions |
|---|---|
| `VIEWER` | Read-only access to all admin and orders pages. Cannot submit any mutation. |
| `DATA_ENTRY` | Full CRUD on all admin and orders pages. Cannot manage users. |
| `ADMIN` | Same as DATA_ENTRY + full access to `/admin/users` (user management). |

---

## Data Model

New Drizzle table: **`user`**

```ts
user {
  id            integer  PK autoincrement
  username      text     unique, not null
  display_name  text     not null
  password_hash text     not null          // bcrypt cost 12
  role          text     CHECK IN ('VIEWER','DATA_ENTRY','ADMIN')
  last_login_at text     ISO-8601, nullable
  created_at    text     ISO-8601, default now
}
```

Migration: new file `src/db/migrations/0002_auth.sql`.

Seed: `scripts/create-user.ts` — CLI script that accepts `--username`, `--display-name`, `--role`, `--password`. Used once at first deploy to create the initial ADMIN account. Errors if username already exists.

---

## Session

**Mechanism:** Signed JWT in an httpOnly, `SameSite=Lax` cookie named `epop_session`.

**Payload:**
```json
{ "sub": 1, "role": "ADMIN", "exp": "<now + 8h>" }
```

**Signing:** `jose` library, HS256, 32-byte secret from `SESSION_SECRET` env var (added to `.env.local` and documented in `.env.example`).

**Lifetime:** 8 hours (one work shift). No refresh tokens — re-login at shift start.

**Helper module:** `src/lib/session.ts`
- `createSessionCookie(user)` → sets the signed cookie on the response
- `getSession(request)` → verifies and returns `{ userId, role }`, or `null` if absent/expired
- `clearSessionCookie()` → returns a cookie that expires immediately

No DB read per request — the JWT is self-contained and verified purely by signature.

---

## Middleware

**File:** `src/middleware.ts`

**Route rules:**

| Path pattern | Rule |
|---|---|
| `/login` | Always pass through |
| `/tablet/*` | Always pass through (open for operators) |
| `/admin/users*` | Require valid session + `role === 'ADMIN'`; others → `/admin` with error |
| `/admin/*` | Require valid session; unauthenticated → `/login?next=<path>` |
| `/orders/*` | Require valid session; unauthenticated → `/login?next=<path>` |
| `/` | Pass through (existing redirect to `/admin/departments`, then middleware gates it) |

---

## Role Enforcement in Server Actions

Middleware guards page access but cannot stop direct POST calls. Every mutating server action gets a guard at the top:

```ts
// src/lib/auth.ts
export async function requireRole(min: Role): Promise<SessionPayload> { ... }
```

Returns the session payload on success. Throws an `UnauthorizedError` if the session is absent or the role is insufficient — the calling server action's `catch` block converts this to `{ error: 'Unauthorized' }`.

**Role hierarchy for `requireRole`:**
- `requireRole('VIEWER')` → any authenticated user
- `requireRole('DATA_ENTRY')` → DATA_ENTRY or ADMIN
- `requireRole('ADMIN')` → ADMIN only

All existing `actions.ts` files add `await requireRole('DATA_ENTRY')` at the top of each mutating function. The `/admin/users/actions.ts` uses `requireRole('ADMIN')`.

---

## Login Flow

**Page:** `src/app/login/page.tsx`  
Simple form: username + password fields, bilingual labels (Arabic/English), matches existing dark-on-white admin aesthetic.

**Action:** `loginAction(formData)`
1. Lookup user by `username`
2. `bcrypt.compare(password, hash)`
3. On failure: return `{ error: 'بيانات غير صحيحة / Invalid credentials' }` — same message regardless of which field was wrong
4. On success: stamp `last_login_at`, call `createSessionCookie(user)`, redirect to `?next` param or `/admin/departments`

**Logout:** A "تسجيل الخروج / Logout" button in the admin nav calls `logoutAction`, which clears the cookie and redirects to `/login`.

---

## User Management (`/admin/users`)

**Access:** ADMIN only (enforced by middleware + `requireRole('ADMIN')` in actions).

**Page:** `src/app/admin/users/page.tsx`  
Lists all users: display name, username, role badge, last login timestamp.

**Actions (`src/app/admin/users/actions.ts`):**
- `saveUser` — create or update. On create: hash password, insert row. On update: change display name and/or role; if password field non-empty, re-hash and update; if blank, leave hash untouched.
- `deleteUser` — guard: cannot delete own account (compares `formData.userId` against session `sub`). Prevents lockout.

**UI:** Reuses the existing `CrudPage` / `Dialog` component pattern from master-data CRUD pages.

**Nav:** The existing admin sidebar/nav gets a "المستخدمون / Users" link, rendered only when `session.role === 'ADMIN'`.

---

## Files Created / Modified

**New:**
- `src/db/migrations/0002_auth.sql`
- `src/db/schema.ts` — add `user` table definition
- `src/lib/session.ts` — cookie helpers
- `src/lib/auth.ts` — `requireRole()` helper
- `src/middleware.ts` — route guard
- `src/app/login/page.tsx` + `actions.ts`
- `src/app/admin/users/page.tsx` + `actions.ts`
- `scripts/create-user.ts` — seed CLI

**Modified:**
- `src/db/schema.ts` — add `user` table definition
- All existing `actions.ts` files — add `requireRole` call at top of each mutation
- `src/app/admin/layout.tsx` — add Users link (ADMIN only) + logout button + session display
- `.env.local` / `.env.example` — add `SESSION_SECRET`
- `package.json` — add `jose`, `bcryptjs` + `@types/bcryptjs`

---

## Out of Scope

- Password reset / forgot-password flow (no email configured)
- OAuth / SSO
- Session revocation (short 8h TTL is the revocation mechanism)
- Rate limiting on `/login` (deferred; internal network only for now)
