# PracOffice — Backend

Node.js + Express + Sequelize backend for PracOffice, focused on the
**register / login pages** of the React frontend:

* `frontend/src/pages/Registration.jsx` → `POST /api/auth/register`
* `frontend/src/pages/Login.jsx` → `POST /api/auth/login`

The mobile number collected at registration is the account password
(hashed with bcrypt), exactly as the forms tell the student. The exam paper is
served by `GET /api/exam` and a finished attempt is accepted by
`POST /api/exam/submit` (the paper itself lives in `services/examPaper.js`).

---

## 1. Requirements

| Requirement | Notes |
|---|---|
| Node.js 18+ | developed and tested on Node 24 |
| PostgreSQL 12+ | the database defined in the project plan (optional) |
| SQLite (optional) | zero-setup fallback for local development and the automated tests |

## 2. Quick start

```bash
cd backend
npm install
cp .env.example .env          # then edit the values you need
npm run dev                   # http://localhost:3000/api
```

`GET http://localhost:3000/api/health` should answer `{"status":"ok", ...}`.

### Using PostgreSQL (per the project plan)

Every connection detail lives in `backend/.env` — the backend reads it through
dotenv in `config/env.js`, so **no host, port, name, user or password is
hardcoded in the source**. Set them in `.env` and flip the dialect:

```ini
# backend/.env
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pracoffice
DB_USER=postgres
DB_PASSWORD=secret
DB_SSL=false
```

A single `DATABASE_URL=postgres://pracoffice:secret@localhost:5432/pracoffice`
is also supported and takes precedence over the five variables above
(`DB_SSL=true` for managed hosts such as Neon, Supabase or Render).

`DB_PORT` must be an integer between 1 and 65535 — a typo fails immediately at
boot instead of silently falling back to 5432. `sequelize.sync()` creates the
missing tables on boot, and the configured database itself is created
automatically the first time the backend connects when it does not exist yet
(best effort — the PostgreSQL role needs `CREATEDB`).

The values are logged on boot (password redacted), e.g.
`[boot] ... db=postgres, target=postgres://postgres@localhost:5432/pracoffice`.

### Using the SQLite fallback (no server needed)

```ini
# backend/.env
DB_DIALECT=sqlite
# DB_STORAGE=:memory:        # optional; defaults to backend/data/pracoffice.<env>.sqlite
```

With `DB_DIALECT` empty the backend **automatically falls back to SQLite**
whenever no PostgreSQL variable is present, which is what happens during
development and in the test suite. Production (`NODE_ENV=production`) always
requires PostgreSQL and the boot fails otherwise.

`.env` is git-ignored, so keep credentials local; `.env.example` is the
committed template and never holds real secrets.

> **npm script note:** recent npm versions block package install scripts until
> they are approved, so `sqlite3`'s native binding may not be compiled on a
> fresh clone. If `require('sqlite3')` fails, run
> `npm approve-scripts sqlite3 && npm rebuild sqlite3`
> (or `npm config set allow-scripts true` before installing). PostgreSQL users
> are not affected.

## 3. Scripts

| Script | Purpose |
|---|---|
| `npm start` | start the API (`server.js`): connect, create missing tables, listen |
| `npm run dev` | the same with nodemon reload |
| `npm test` | automated tests (node:test, HTTP integration against the Express app) |
| `npm run test:watch` | re-run the suite on file changes |

## 4. Architecture

```
backend/
├─ app.js                 Express app (routes, CORS, JSON body, error handling)
├─ server.js              bootstrap: DB connect → sync → listen → graceful shutdown
├─ config/
│  ├─ env.js              validated configuration (env vars, dialect resolution)
│  └─ database.js         Sequelize instance (Postgres | SQLite)
├─ models/                users (+ syncDatabase)
├─ routes/                /api/auth
├─ controllers/           thin request/response layer
├─ middleware/            JWT auth, request logger, validation, error handler
├─ services/
│  └─ authService.js      register / login / profile (bcrypt + JWT)
├─ utils/                 AppError, asyncHandler, validators
└─ tests/                 node:test suites + harness
```

## 5. Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | `production` enforces PostgreSQL + a real `JWT_SECRET` |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | HTTP listener |
| `CORS_ORIGIN` | `*` | comma separated allowed origins (e.g. `http://localhost:5173`) |
| `JWT_SECRET` | dev default | signing key, min 16 chars, **required** in production |
| `JWT_EXPIRES_IN` | `7d` | token lifetime |
| `BCRYPT_SALT_ROUNDS` | `10` | password hashing cost |
| `DB_DIALECT` | `sqlite` | `postgres` or `sqlite` |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port, integer 1–65535 |
| `DB_NAME` | `pracoffice` | PostgreSQL database (created on boot if missing) |
| `DB_USER` | `postgres` | PostgreSQL user |
| `DB_PASSWORD` | – | PostgreSQL password (keep it in `.env`, never in git) |
| `DB_SSL` | `false` | required by managed hosts |
| `DATABASE_URL` | – | connection string that overrides the five variables above |
| `DB_STORAGE` | `data/pracoffice.<env>.sqlite` | SQLite file, or `:memory:` |
| `DB_LOGGING` | `false` | log every SQL statement |
| `DB_SYNC_ALTER` | `false` | run `sync({ alter: true })` on boot (development only) |
| `JSON_LIMIT` | `2mb` | maximum accepted request body |


## 6. Database

Tables follow the project plan (snake_case columns, `created_at` only).

**users** — `id`, `name`, `email` (unique), `mobile` (unique), `dob` (DATEONLY),
`username` (unique), `password` (bcrypt hash of the mobile number), `created_at`.

Tables are created automatically on boot (`sequelize.sync()`); `alter` is opt-in.

### Authentication rules

* Registration collects **username, email, mobile number and date of birth**
  (the exact fields of the Registration page); the **password is the mobile
  number** (hashed with bcrypt) unless a password is supplied.
* When no `username` is sent it is derived from the email (for example
  `ali.khan@x.com` → `ali.khan`) with a numeric suffix when it is already
  taken. Client usernames are 3–60 chars: letters, digits, `.`, `_`, `-`.
* `name` is optional and defaults to the username.
* Login accepts the **username or the email** plus the password.
* Passwords never leave the API: every response excludes the hash.

---

## 7. API reference

Base URL: `http://localhost:3000/api` · All responses are JSON.
Protected routes need `Authorization: Bearer <token>`
(the frontend stores the token as `localStorage["token"]`).

Errors always use the same shape:

```json
{ "message": "Validation failed", "errors": [{ "field": "email", "message": "Enter a valid email address" }] }
```

| Code | Meaning |
|---|---|
| 400 | validation failure / malformed request |
| 401 | missing, invalid or expired token; wrong credentials |
| 404 | unknown route or resource |
| 409 | duplicate email / mobile / username |
| 413 | body larger than `JSON_LIMIT` |
| 500 / 503 | unexpected error / database unavailable |

### `POST /api/auth/register`

Exactly what the Registration form collects:

```json
{ "username": "ali", "mobileNumber": "9123456789", "email": "ali@example.com", "dateOfBirth": "2001-05-14" }
```

`201` → `{ "message": "...", "user": { "id", "name", "email", "mobile", "dob", "username", "createdAt" }, "token": "...", "expiresIn": "7d" }`

The password is created as the mobile number, so the student logs in with
**username + mobile number** (the response includes the created username).
Legacy clients may send `mobileno`/`mobile` instead of `mobileNumber`, `dob`
instead of `dateOfBirth`, and an optional `name`.

### `POST /api/auth/login`

```json
{ "username": "ali", "password": "9123456789" }     // "email" also accepted
```

`200` → `{ "message": "Login successful", "user": {...}, "token": "...", "expiresIn": "7d" }`

### `GET /api/auth/me` 🔒

`200` → `{ "user": { "id", "name", "email", "mobile", "dob", "username", "createdAt" } }`

### `GET /api/exam` 🔒

The fixed qualifying-test paper - exactly what
`frontend/src/services/examService.js` renders. `services/examPaper.js` is the
source of truth; the frontend keeps a bundled snapshot of the same paper so it
can still render when the API is unreachable.

`200` → `{ "exam": { "title", "description", "duration": 30, "durationSeconds", "totalMarks": 50, "partCount": 5, "parts": [ ... ] } }`

Every part carries `id`, `key` (A–E), `name`, `totalMarks` and a `questions[]`
array. Each question has `id`, `label`, `title`, `marks`, `instructions`
(newline separated, exactly as the page renders them) and its graded `tasks[]`.
Parts A and B hold **two questions each**, so the paper has **seven question
pages**; each page shows its question and the matching software section below
it. Question marks add up to the part total (15/10/10/10/5) and the parts to 50.

### `POST /api/exam/submit` 🔒

Body: the finished attempt, for example `{ "parts": { "word": { ... } } }`
(the current frontend sends `{ "parts": {} }`). An empty body is accepted.

`200` → `{ "message": "Exam submitted successfully. Evaluation is pending.", "submittedAt": "...", "totalMarks": 50, "obtainedMarks": 0, "status": "pending", "parts": [ { "id", "key", "name", "totalMarks", "obtainedMarks", "status" } ] }`

Automatic per-task marking is not implemented yet, so every part is reported as
`pending` - the same state the Results page displays.

### `GET /api/health`

`200` → `{ "status": "ok", "environment": "development", "database": "sqlite", "time": "..." }`
