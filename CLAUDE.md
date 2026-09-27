# Hotel Management System — Project Context

This file gives Claude Code context about this project. Read this first before making changes.

---

## Project Overview

Fullstack Hotel Management System.

- **Backend:** NestJS 11 + Prisma 7 + PostgreSQL (Neon) + Redis + AWS S3
- **Frontend:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Zustand + Zod + Axios
- **Dev:** BangDEV (Bùi Công Bằng) — Software Engineering student at STU

Repo structure:

```
Hotel/
├── api/     ← NestJS backend
└── front/   ← React frontend
```

---

## Backend — Architecture

**Pattern:** Modular monolith, one module per domain under `api/src/modules/`.

- Global `JwtAuthGuard` + `@Public()` decorator to bypass auth on specific routes
- `RolesGuard` reads roles from `request.user` (set by Passport JWT strategy)
- `TransformInterceptor` wraps every response as:
  ```json
  { "success": true, "statusCode": 200, "message": "...", "data": {...}, "timestamp": "..." }
  ```
- `HttpExceptionFilter` handles all thrown exceptions
- Auth: accessToken (15 min, Bearer header) + refreshToken (7 days, HttpOnly Cookie `refresh-token`)
- Roles: `admin`, `manager`, `staff`, `customer` — applied via `@Roles('staff', 'manager', 'admin')`

**Prisma 7 notes:**

- `datasource db` has no `url` in schema — configured via `prisma.config.ts`
- `PrismaService` uses `@prisma/adapter-pg`
- After ANY schema change: run `npx prisma migrate dev --name <name>` then `npx prisma generate`

**Common infra** (`api/src/common/`):

```
decorators/  → get-account.decorator.ts, public.decorator.ts, role-decorator.ts
filters/     → http-exception.filter.ts
guards/      → jwt-auth.guard.ts, roles.guard.ts
interceptors/→ transform.interceptor.ts
s3/          → s3.service.ts (AWS S3 upload, 5MB limit, jpeg/png/webp only)
redis/       → redis.service.ts (cache + token blacklist)
mail/        → mail.service.ts (Nodemailer + Handlebars templates)
throttler/   → rate limiting config
```

---

## Backend — Modules (all implemented)

| Module   | Key routes                                                                     |
| -------- | ------------------------------------------------------------------------------ |
| Auth     | register, login, logout, refresh                                               |
| Employee | CRUD, profile, reset-password, shifts                                          |
| Shift    | CRUD, assign employees, schedule view                                          |
| RoomType | CRUD, soft delete (`is_active`)                                                |
| Room     | CRUD, status transitions, soft delete (`status: inactive`), `/rooms/available` |
| Customer | CRUD, walk-in guest creation, link-account, profile                            |
| Booking  | create, confirm, check-in, check-out, cancel, add/remove services              |
| Service  | CRUD, add/remove from booking                                                  |
| Invoice  | view, update discount                                                          |
| Payment  | create (supports partial payments), view                                       |

**Booking status flow:** `pending → confirmed → checked_in → checked_out` (or `cancelled` at pending/confirmed)

**Important business rules:**

- Online booking → starts `pending`, staff must call `/bookings/:id/confirm` to create Invoice
- Walk-in booking → starts `confirmed` directly, Invoice created immediately (staff is present)
- Never auto-checkin — staff always does that manually even for walk-in
- Booking overlap check must exclude `cancelled` AND `checked_out` statuses
- On cancel: Invoice status → `cancelled` (not `unpaid`), Room status stays `available` (rooms are only `occupied` after check-in)
- Check-out updates `check_out_date = actual_check_out` to keep overlap checks accurate

---

## Database Schema

Located at `api/prisma/schema.prisma`. Key enums:

```
RoomStatus:     available, occupied, maintenance, cleaning, inactive
BookingStatus:  pending, confirmed, checked_in, checked_out, cancelled
BookingType:    online, walk_in
InvoiceStatus:  unpaid, paid, partially_paid, cancelled
PaymentMethod:  cash, bank_transfer, e_wallet, credit_card
CustomerSource: walk_in, online_registration
BedType:        single, double, twin, king, queen
```

Customer model handles BOTH online and walk-in customers (merged, no separate Guest table).
`account_id` is nullable on Customer — null means walk-in with no login.

---

## Backend Conventions

- DTOs validated with `class-validator` + Swagger `@ApiProperty` decorators
- Every list endpoint: pagination (`page`, `limit`), returns `{ data, total, page, limit, totalPages }`
- Prisma `Decimal` fields (price, salary, amount) → always `Number(value)` before returning
- Soft delete pattern: `is_active: false` (RoomType, Service) or `status: 'inactive'` (Room), or account `is_active: false` (Customer/Employee)
- Error messages in Vietnamese
- Route order matters: static routes (`/profile`, `/available`) must be declared BEFORE dynamic routes (`/:id`)
- Helper pattern in services: `xxxSelect()` for reusable Prisma select, `transformXxx()` for reusable response mapping

---

## Frontend — Architecture

```
front/src/
├── api/               → axiosInstance.ts + one file per module (employeeApi.ts, roomApi.ts...)
├── types/              → one file per module, matches backend DTOs
├── components/         → shared (AdminLayout.tsx, ui/ from shadcn)
└── features/<module>/
    ├── store/           → Zustand store
    ├── components/      → Form, Table, Filters (per module)
    └── <Module>Management.tsx   → main page
```

**Zustand store pattern** (follow exactly, see `employeeStore.ts` as reference):

```typescript
interface XxxState {
  items: Xxx[]; total: number; totalPages: number;
  loading: boolean; error: string | null;
  filters: XxxFilters;
  setFilters: (f: Partial<XxxFilters>) => void;  // auto re-fetches
  fetchXxx: () => Promise<void>;
  createXxx, updateXxx, deleteXxx: (...) => Promise<void>;
  clearError: () => void;
}
```

- `setFilters` always resets `page: 1` and re-fetches automatically
- After create/update/delete → always re-fetch the list
- On error → `set({ error: e.response?.data?.message ?? 'fallback message' })`

**Design tokens** (already in use across Employee/RoomType/Customer pages):

```
Primary (Navy):   #1B3A5C
Accent (Gold):    #C9A84C
Background:       #F7F7F5
Card:             #FFFFFF
Muted bg:         #F0F0EA
Border:           #E2E2D8
Text:             #0A0A0A
Muted text:       #64748B
Destructive:      #8C1D18
```

Use **Tailwind utility classes** with these hex values directly (e.g. `bg-navy-700`) — do NOT write plain CSS files. This project uses Tailwind + shadcn/ui throughout, not custom CSS.

**Form pattern:** React Hook Form + `@hookform/resolvers/zod`, separate Zod schema for create vs edit (edit schema usually `.partial()` or hand-written subset).

**Already built and working (reference these for consistency):**

- Employee Management (full CRUD + reset password)
- RoomType Management (full CRUD + amenities picker)
- Customer Management (full CRUD + walk-in creation + detail drawer)

**Still needs backend connection / not yet built:**

- Room Management (status transitions UI)
- Booking Management (multi-step: create → confirm → check-in → check-out)
- Invoice / Payment UI
- Auth pages (login/register) + `authStore.ts` with role-based routing
- `ProtectedRoute` component

---

## API Base

```
Backend base URL: http://localhost:3001/api/v1
Swagger docs:     http://localhost:3001/api/docs
Frontend:         http://localhost:5173 (Vite default) or :3000
```

`.env` (frontend): `VITE_API_URL=http://localhost:3001/api/v1`

Auth: access token in `localStorage` as `access_token`, attached as `Authorization: Bearer <token>`. Refresh token lives in HttpOnly cookie, auto-refreshed on 401 via axios interceptor.

---

## Commands

```bash
# Backend (run from api/)
npm run dev                                    # start dev server
npx prisma migrate dev --name <description>    # after schema changes
npx prisma generate                             # regenerate client (after migrate or enum errors)
npx prisma db seed                              # seed roles + manager account

# Frontend (run from front/)
npm run dev
```

Seed manager account: `manager@hotel.com` / `Manager@123`

---

## What NOT to do

- Don't create a separate `Guest` table — Customer already handles walk-in via `source: 'walk_in'` and nullable `account_id`
- Don't write plain `.css` files for new frontend pages — use Tailwind classes matching the tokens above
- Don't auto-confirm online bookings — only walk-in bookings skip the `pending` state
- Don't put `select` and `include` together in the same Prisma query — use nested `select`
- Don't forget: static routes before dynamic `:id` routes in controllers
