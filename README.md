# MiniLedger

Track money you've lent to friends. Phone + (mock) OTP login, add loans, mark them repaid, see a summary, attach a receipt photo.

## Demo

Screen recording (no audio): **[(https://drive.google.com/drive/folders/1M9n5ixzM3Nd-h9_irZBHvaglX_hwjMqC?usp=sharing)]**

The video shows: opening the app in Expo Go via QR code, logging in with a phone number, the mock OTP printed in the backend terminal, adding loans (one with a receipt photo, one overdue and highlighted in red), marking a loan as repaid, and the summary card updating.

## Tech stack

| Layer | Stack |
|---|---|
| API | Node.js 20+, TypeScript, Express 5, PostgreSQL (`pg`), Zod, JWT, Multer |
| App | React Native (Expo), TypeScript, `expo-secure-store`, `expo-image-picker`, `expo-file-system` |

```
miniledger/
├── backend/   REST API + SQL schema + tests
├── mobile/    Expo app (Login, Loans list + summary, Add loan)
└── docker-compose.yml   Postgres 16 (dev DB + separate test DB)
```

## Prerequisites

- **Node.js 20 or newer** (`node -v`)
- **PostgreSQL 14+**, either through Docker or installed locally (including pgAdmin)
- **Expo Go** on your phone, or an Android emulator / iOS simulator.
  Expo Go must support the Expo SDK the project uses. Check the `expo` version in `mobile/package.json`.

## Run it

### 1. Database

**Option A: Docker**
```bash
docker compose up -d        # Postgres on :5432, creates `miniledger` and `miniledger_test`
```

**Option B: local PostgreSQL (no Docker)**

Create a login role and two databases, either with pgAdmin or with SQL:

```sql
CREATE USER miniledger WITH PASSWORD 'miniledger' CREATEDB;
CREATE DATABASE miniledger OWNER miniledger;
CREATE DATABASE miniledger_test OWNER miniledger;
```

With pgAdmin: right-click **Login/Group Roles → Create** for the user, then right-click **Databases → Create → Database** twice, setting the owner to `miniledger`.
If your PostgreSQL does not use port 5432, change the port in `backend/.env` after step 2.

The `miniledger_test` database is separate on purpose: the tests empty their tables, so they never touch your dev data.

### 2. Backend

```bash
cd backend
cp .env.example .env        # Windows: copy .env.example .env
npm install
npm run dev                 # creates tables automatically, listens on :3000
```

You should see `MiniLedger API listening on :3000`. Check `http://localhost:3000/health` in a browser: it returns `{"ok":true}`.

**The OTP is printed in this terminal**, for example `[MOCK OTP] +919876543210 -> 482913`. Keep this terminal visible when logging in.

### 3. Mobile app

```bash
cd mobile
npm install
npx expo start
```

Then press `a` (Android emulator), `i` (iOS simulator), or scan the QR code with Expo Go.

On emulators the app finds the API automatically (`10.0.2.2` on Android, `localhost` on iOS).

On a **physical phone**, point the app at your computer's IP address. The phone and computer must be on the same network (a phone hotspot works too). Find your IP with `ipconfig` (Windows) or `ifconfig` (macOS/Linux), then:

```bash
# macOS / Linux
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 npx expo start

# Windows (Command Prompt)
set EXPO_PUBLIC_API_URL=http://192.168.1.20:3000
npx expo start

# Windows (PowerShell)
$env:EXPO_PUBLIC_API_URL="http://192.168.1.20:3000"
npx expo start
```

Tip: open `http://<your-ip>:3000/health` in your phone's browser first. If it shows `{"ok":true}`, the phone can reach the backend. On Windows, allow Node.js through the firewall for private networks if it does not load.

### 4. Log in

Enter any phone number in international format (for example `+919876543210`) and tap **Send OTP**. Read the 6-digit code from the **backend terminal** and enter it in the app. Each phone number is its own account.

### 5. Tests

```bash
cd backend && npm test      # 29 tests: validation, OTP logic, full API flows against the test DB
cd mobile && npm run typecheck
```

## Troubleshooting

| Problem | Fix |
|---|---|
| "Project is incompatible with this version of Expo Go" | Update Expo Go, or use the Expo SDK your Expo Go supports (`npx expo install expo@^<sdk>` then `npx expo install --fix` in `mobile/`). |
| QR code address shows `127.0.0.1` | Set `REACT_NATIVE_PACKAGER_HOSTNAME` to your computer's IP before `npx expo start --lan`. |
| App says "Cannot reach the server" | The backend is not running, or `EXPO_PUBLIC_API_URL` is wrong or the IP changed (a hotspot gets a new IP when reconnected). Re-check with `ipconfig` and the `/health` test above. |
| Backend: `ECONNREFUSED 5432` | PostgreSQL is not running or uses a different port. Fix the port in `backend/.env`. |
| Backend: `password authentication failed` | The database user or password does not match `backend/.env`. |
| Port 3000 already in use | Set `PORT=3001` in `backend/.env` and update `EXPO_PUBLIC_API_URL` to match. |
| OTP not visible | It is printed in the **backend** terminal, not the Expo terminal. |
| Cannot request another OTP | The resend limit is 30 seconds. Wait, or use a different number. |
| To log out without the button | Clear Expo Go's storage in the phone settings, or log in with a different number after logging out. |

## API

All routes except `/auth/*` need `Authorization: Bearer <token>`. Errors are always `{ "error": "message", "details"?: [...] }`.

| Method & path | Body | Result |
|---|---|---|
| `POST /auth/request-otp` | `{ phone }` (E.164, e.g. `+919876543210`) | `200`; OTP is logged on the server. `429` if requested again within 30 s |
| `POST /auth/verify-otp` | `{ phone, otp }` | `{ token, user }`. `401` wrong code, `400` expired / too many attempts |
| `GET /loans` | | `{ loans: [...] }` unpaid first (soonest due first), each with `isOverdue` |
| `POST /loans` | JSON or `multipart/form-data`: `friendName`, `amount`, `dueDate` (`YYYY-MM-DD`), optional `receipt` image (jpeg/png/webp, ≤ 5 MB) | `201 { loan }` |
| `POST /loans/:id/repay` | | `200 { loan }`; `409` if already repaid; `404` if not yours |
| `GET /loans/:id/receipt` | | the image (owner only) |
| `GET /summary` | | `{ totalLent, totalRepaid, outstanding, overdueAmount }` |
| `GET /health` | | `{ ok: true }` (no auth) |

Quick curl demo:
```bash
curl -XPOST localhost:3000/auth/request-otp -H 'content-type: application/json' -d '{"phone":"+919876543210"}'
# read the OTP from the server log, then:
curl -XPOST localhost:3000/auth/verify-otp -H 'content-type: application/json' -d '{"phone":"+919876543210","otp":"482913"}'
```

## Design decisions (the "why", for review)

- **Money is integer cents** (`BIGINT amount_cents`). Floats can't represent 0.1 + 0.2 exactly; the API converts at the edge.
- **Definitions.** *Total lent* = every loan ever added. *Total repaid* = sum of loans with `repaid_at` set. *Overdue* = not repaid **and** `due_date < today` (due today is not overdue). *Outstanding* = lent − repaid. The summary is one SQL statement using `SUM(...) FILTER (WHERE ...)`.
- **Overdue is computed in SQL at read time**, not stored, so it can never go stale. `CURRENT_DATE` uses the DB session timezone (UTC by default). Per-user timezones would be the next refinement.
- **OTP security (even though it's mocked):** 6 digits from `crypto.randomInt`; stored as an HMAC bound to the phone (never plaintext); 5-minute expiry; single use; max 5 attempts enforced by one atomic `UPDATE ... RETURNING` (so parallel guesses can't beat the limit); 30 s resend throttle; timing-safe comparison. Swapping in a real SMS provider is a one-line change where `console.log('[MOCK OTP]')` is.
- **Auth:** JWT (7 days) with the user id as `sub`. The server refuses to start in production without `JWT_SECRET`. The app keeps the token in the OS keychain/keystore via `expo-secure-store`, and any 401 logs the user out.
- **Authorization:** every query is scoped with `WHERE user_id = $1`. Another user's loan returns `404`, not `403`, so IDs can't be probed. Tests cover this.
- **Repay is race-free and idempotent-safe:** `UPDATE ... WHERE repaid_at IS NULL`; the DB decides who wins.
- **Receipts:** the server generates the filename (no path traversal), allow-lists MIME types, caps size at 5 MB, deletes the file if validation or the DB insert fails, and serves it only to the owner through an authenticated route. The app sends the token in the image request headers.
- **Receipt upload on the app side:** loans without a photo are sent as JSON with `fetch`. Loans with a photo use Expo's native multipart uploader (`uploadAsync` from `expo-file-system`), because `fetch` with `FormData` and a local file URI failed on Android during testing.
- **Validation** lives in one Zod module on the server (source of truth); the app mirrors the rules for instant feedback.
- **No navigation library:** three screens, so a small state switch is enough. React Navigation would be the next step if screens multiply.

## Known limitations / what I'd do next

- Due date is a typed `YYYY-MM-DD` field; a native date picker would be nicer.
- No refresh tokens, per-IP rate limiting, or pagination (`GET /loans` returns everything).
- Receipts are stored on local disk; production would use S3-style object storage.
- No edit/delete loan, partial repayments, or push reminders.
- The mobile app has a typecheck only. Component and end-to-end tests (Jest + React Native Testing Library, Maestro or Detox) are not included.
- The mobile app was tested manually on an Android phone with Expo Go.