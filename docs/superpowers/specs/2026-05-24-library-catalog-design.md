# Library Catalog — Design Spec

**Date:** 2026-05-24
**Status:** Approved — ready for implementation planning

## 1. Purpose and scope

A minimal REST service that manages books, authors, and simple reservations. The focus areas are:

- Reliable indexed search over books by title and author with deterministic ranking.
- A reservation endpoint with a precise, enforceable concurrency rule.
- Swagger UI for exercising search and reservation flows.
- Automated tests that run in GitHub Actions on PR open and on every new commit; failures block merge.

Non-goals are listed in §11.

## 2. Acceptance criteria

1. Search returns correctly ranked results for the provided cases in §8.3.
2. The reservation endpoint enforces: **at most one ACTIVE or CHECKED_OUT reservation per book copy**. Concurrent attempts on the last available copy result in exactly one success (201) and the rest 409 Conflict.
3. Unit tests cover CRUD and search ranking. Integration tests cover the full reservation lifecycle and a concurrent reservation attempt. All tests run on GitHub Actions on PR open and on subsequent commits; required status checks block merging on failure.

## 3. Technology stack

| Concern | Choice |
|---|---|
| Runtime | Node.js **24.16.0** (pinned via `.nvmrc`) |
| Language | TypeScript (strict) |
| Framework | NestJS |
| ORM | Prisma |
| Database | PostgreSQL **18.4** (`postgres:18.4-alpine` for local + CI) |
| Search | Postgres full-text search (`tsvector` + `tsquery` + `ts_rank_cd`, GIN index) |
| API docs | `@nestjs/swagger` mounted at `/api/docs` |
| Validation | `class-validator` (including `@IsISBN()`) + global `ValidationPipe` |
| Unit testing | Jest with mocked Prisma |
| Integration testing | Jest + supertest against an ephemeral Postgres |
| CI | GitHub Actions |

## 4. Architecture

A single NestJS application with feature modules: `AuthorsModule`, `BooksModule`, `SearchModule`, `ReservationsModule`. A shared `PrismaModule` exposes a `PrismaService` with lifecycle hooks. A `CommonModule` provides validation pipes, exception filters (Prisma → HTTP error mapping), and the `@CurrentUserId()` decorator.

```
┌────────────────────────┐
│   Swagger UI (/docs)   │
└──────────┬─────────────┘
           │ HTTP
┌──────────▼─────────────┐
│      NestJS App        │
│  Controllers           │  @nestjs/swagger decorators
│  Services              │  business rules (search ranking, reservation FSM)
│  Prisma Client         │  typed DB access; raw SQL for tsvector + atomic update
└──────────┬─────────────┘
           │
       ┌───▼────┐
       │Postgres│ (tsvector GIN index, books/authors/users/reservations)
       └────────┘
```

### 4.1 Concurrency strategy (Approach A — atomic UPDATE with predicate)

All reservation state-changing endpoints execute inside a single Prisma `$transaction`. Decrement of `available_copies` uses a single atomic statement:

```sql
UPDATE books
   SET available_copies = available_copies - 1
 WHERE id = $1
   AND available_copies > 0
RETURNING id;
```

If no row is returned, the service throws `ConflictException` (HTTP 409) and the transaction rolls back. If a row is returned, the reservation row is inserted in the same transaction. Symmetrically, return and cancel paths use `UPDATE … SET available_copies = available_copies + 1 WHERE id = $1 AND available_copies < total_copies RETURNING id`.

This pattern relies on row-level locks Postgres acquires for the `UPDATE`, giving us serialisation per book without any explicit `SELECT FOR UPDATE` or advisory locks.

## 5. Data model

```sql
CREATE TYPE reservation_status AS ENUM ('ACTIVE','CHECKED_OUT','RETURNED','CANCELLED');

authors (
  id          uuid PRIMARY KEY,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

books (
  id                 uuid PRIMARY KEY,
  title              text NOT NULL,
  author_id          uuid NOT NULL REFERENCES authors(id),
  isbn               text NOT NULL UNIQUE,
  total_copies       int  NOT NULL CHECK (total_copies >= 0),
  available_copies   int  NOT NULL CHECK (available_copies >= 0 AND available_copies <= total_copies),
  search_vector      tsvector GENERATED ALWAYS AS (
                        setweight(to_tsvector('simple', title), 'A')
                     ) STORED,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX books_search_idx    ON books USING GIN (search_vector);
CREATE INDEX books_author_id_idx ON books (author_id);

users (
  id          uuid PRIMARY KEY,
  email       text UNIQUE NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

reservations (
  id              uuid PRIMARY KEY,
  book_id         uuid NOT NULL REFERENCES books(id),
  user_id         uuid NOT NULL REFERENCES users(id),
  status          reservation_status NOT NULL,
  reserved_at     timestamptz NOT NULL DEFAULT now(),
  checked_out_at  timestamptz,
  returned_at     timestamptz,
  cancelled_at    timestamptz
);
CREATE INDEX reservations_book_status_idx ON reservations (book_id, status);
CREATE INDEX reservations_user_idx        ON reservations (user_id);
```

### 5.1 Ranking

- `search_vector` is a Postgres **stored generated column** containing the book title only, weighted `'A'`. Postgres maintains it automatically.
- Author name is **not** part of the stored vector. It is joined and vectorised at query time so author renames do not require batch updates.
- The score formula:
  ```
  ts_rank_cd(books.search_vector,                          q) * 1.0
+ ts_rank_cd(to_tsvector('simple', authors.name),          q) * 0.5
  ```
  Title outweighs author. Results are ordered by `(score DESC, title ASC, books.id ASC)` for deterministic tie-breaking.

### 5.2 Reservation FSM

```
        reserve                check_out               return
   ∅ ─────────────► ACTIVE ───────────────► CHECKED_OUT ────────► RETURNED
                       │
                       └────── cancel ──────► CANCELLED
```

Illegal transitions throw `ConflictException` (HTTP 409). Encoded as a pure function `reservationTransition(currentStatus, action) → nextStatus` and unit-tested exhaustively.

## 6. REST API

All routes return JSON. Errors follow Nest's default `{ statusCode, message, error }` shape. The `X-User-Id` header (UUID) is required on all reservation write routes; a `UserExistsGuard` returns 401 if absent or unknown.

### 6.1 Authors
| Method | Path | Body / Query | Returns |
|---|---|---|---|
| `POST` | `/authors` | `{ name }` | 201 `Author` |
| `GET` | `/authors/:id` | — | 200 `Author` / 404 |
| `GET` | `/authors` | `?page&pageSize` | 200 `{ items, total, page, pageSize }` |
| `PATCH` | `/authors/:id` | `{ name? }` | 200 `Author` |
| `DELETE` | `/authors/:id` | — | 204 / 409 if author has books |

### 6.2 Books
| Method | Path | Body / Query | Returns |
|---|---|---|---|
| `POST` | `/books` | `{ title, authorId, isbn, totalCopies }` (all required) | 201 `Book` (`availableCopies = totalCopies`) |
| `GET` | `/books/:id` | — | 200 `Book` (with embedded `author`) |
| `GET` | `/books` | `?page&pageSize&authorId?` | 200 `{ items, total, page, pageSize }` |
| `PATCH` | `/books/:id` | `{ title?, authorId?, isbn?, totalCopies? }` | 200 `Book` — `totalCopies` delta adjusts `availableCopies`; rejected if it would drive `availableCopies` negative |
| `DELETE` | `/books/:id` | — | 204 / 409 if non-terminal reservations exist |

`isbn` is validated with `@IsISBN()` and stored `NOT NULL UNIQUE`. Duplicate ISBN → 409 (via `PrismaExceptionFilter` mapping `P2002`).

### 6.3 Search
| Method | Path | Query | Returns |
|---|---|---|---|
| `GET` | `/search/books` | `q` (required), `page?`, `pageSize?`, `authorId?` | 200 `{ items: BookWithScore[], total, page, pageSize }` |

- `q` is parsed with `plainto_tsquery('simple', $1)` (parameterised, safe).
- Empty `q` → 400.
- `BookWithScore` extends `Book` with `score: number` to make ranking assertable.

### 6.4 Reservations

`X-User-Id` required on all write routes.

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/reservations` | `{ bookId }` | **201** `Reservation` (full object incl. `id`, status `ACTIVE`) + `Location: /reservations/{id}` header. 409 if no copies. 404 unknown book. 400 invalid. |
| `POST` | `/reservations/:id/check-out` | — | 200 `Reservation` (status `CHECKED_OUT`) / 409 if not ACTIVE / 403 if caller is not owner |
| `POST` | `/reservations/:id/return` | — | 200 `Reservation` (status `RETURNED`); also `available_copies += 1` atomically. 409 if not CHECKED_OUT. 403 if not owner. |
| `POST` | `/reservations/:id/cancel` | — | 200 `Reservation` (status `CANCELLED`); also `available_copies += 1` if previous status was ACTIVE. 409 if not ACTIVE. 403 if not owner. |
| `GET` | `/reservations/:id` | — | 200 `Reservation` / 404 |
| `GET` | `/reservations` | `?userId?&bookId?&status?&page?&pageSize?` | 200 `{ items: Reservation[], total, page, pageSize }` |

Pagination defaults: `page=1`, `pageSize=20`, `pageSize` capped at 100.

## 7. Validation, errors, and operational concerns

- **Global `ValidationPipe`** with `{ whitelist: true, forbidNonWhitelisted: true, transform: true }`.
- **`PrismaExceptionFilter`** maps `P2002` → 409, `P2025` → 404; otherwise → 500.
- **Config** via `@nestjs/config` from `.env` (`DATABASE_URL`, `PORT`). `.env.example` committed.
- **Logging**: Nest's built-in logger; no external sink in MVP.

## 8. Testing strategy

### 8.1 Unit tests (Jest, no DB)

Services are tested with mocked Prisma:

- `AuthorsService` and `BooksService` CRUD happy paths and edge cases:
  - Duplicate ISBN → 409.
  - `totalCopies < 0` → 400.
  - Deleting an author who has books → 409.
  - `PATCH /books` reducing `totalCopies` below `total - available` → 400.
- `RankingService` (or `SearchService.rank()` extracted as a pure function): asserts ordering against fixed candidate sets; independent of Postgres.
- `reservationTransition(currentStatus, action)`: exhaustive matrix over 4 statuses × 4 actions; legal transitions return the expected next status, illegal ones throw.

### 8.2 Integration tests (Jest + supertest, real Postgres)

`test/globalSetup.ts` runs `prisma migrate deploy` against a dedicated test database and seeds users. Each spec resets relevant tables before/after.

Two required suites:

1. **`reservation-lifecycle.e2e-spec.ts`** — one user, one book with `totalCopies=1`:
   - `POST /reservations` → 201, status `ACTIVE`, `available_copies` 1→0.
   - `POST /reservations/:id/check-out` → 200, status `CHECKED_OUT`, `checked_out_at` set.
   - `POST /reservations/:id/return` → 200, status `RETURNED`, `returned_at` set, `available_copies` 0→1.
   - Asserts illegal transitions (e.g. check out a returned reservation) → 409.

2. **`reservation-concurrent.e2e-spec.ts`** — one book with `availableCopies=1`, 10 users firing `POST /reservations` in parallel via `Promise.all`:
   - Exactly 1 response is 201.
   - Exactly 9 responses are 409.
   - `available_copies` ends at 0.
   - Exactly 1 ACTIVE reservation row exists for that book.

### 8.3 Search ranking acceptance cases

Checked in at `test/fixtures/search-cases.ts` and consumed by parameterised tests.

| # | Setup | Query | Expected |
|---|---|---|---|
| 1 | Books "Clean Code", "The Clean Coder", "Code Complete" | `clean code` | "Clean Code" ranks first (best phrase match, title weight A) |
| 2 | Same books as #1 | `code` | Order determined by `ts_rank_cd` and the stable secondary sort `(title ASC, id ASC)` |
| 3 | Book "Refactoring" by author "Martin Fowler" | `fowler` | "Refactoring" returned via author-vector join |
| 4 | Book "Domain-Driven Design" by "Eric Evans" | `domain driven` | Matched despite hyphenation (verifies `to_tsvector('simple')` tokenisation) |
| 5 | Two identical-title books with different authors | identical title | Both returned, deterministic order by `(score DESC, title ASC, id ASC)` |
| 6 | Any books seeded | `'; DROP TABLE` | Empty result, no error, no injection (verifies `plainto_tsquery` parameterisation) |
| 7 | Any | `q=` | 400 |
| 8 | Any | `the of` (stopwords) | Empty result, not an error |
| 9 | 25 matching books | `q=<term>&page=2&pageSize=10` | Items 11–20, `total=25` |

### 8.4 CI workflow (`.github/workflows/ci.yml`)

- **Triggers:** `pull_request` (opened, synchronize, reopened) and `push` to PR branches.
- **Job `lint-and-unit`:** Node 24.16.0 → `npm ci` → `npm run lint` → `npm run test:unit`.
- **Job `integration`:** Node 24.16.0 + `services: postgres:18.4-alpine` → `npm ci` → `prisma migrate deploy` → `npm run test:integration`.
- Both jobs run in parallel.
- Branch protection on `main` requires both checks to pass → merge blocked on failure.

## 9. Project layout

```
/
├── .github/workflows/ci.yml
├── .nvmrc                          # 24.16.0
├── docker-compose.yml              # postgres:18.4-alpine
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── main.ts                     # bootstrap + Swagger at /api/docs
│   ├── app.module.ts
│   ├── prisma/                     # PrismaService
│   ├── common/
│   │   ├── filters/                # PrismaExceptionFilter
│   │   ├── pipes/                  # ValidationPipe wiring
│   │   ├── guards/                 # UserExistsGuard
│   │   └── decorators/             # @CurrentUserId()
│   ├── authors/
│   ├── books/
│   ├── search/                     # SearchService + RankingService (pure)
│   └── reservations/               # ReservationsService + pure transition fn
├── test/
│   ├── integration/
│   │   ├── reservation-lifecycle.e2e-spec.ts
│   │   └── reservation-concurrent.e2e-spec.ts
│   ├── fixtures/
│   │   └── search-cases.ts
│   ├── globalSetup.ts
│   └── jest-e2e.config.ts
├── jest.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

## 10. Developer experience

- `docker compose up -d db` — start Postgres 18.4 on localhost:5432.
- `npm run db:migrate` — `prisma migrate dev`.
- `npm run db:seed` — seed 3 users and a small books/authors set.
- `npm run start:dev` — Nest watch mode. Swagger at `http://localhost:3000/api/docs`.
- `npm run test:unit` and `npm run test:integration` mirror the CI jobs.

## 11. Out of scope (explicit YAGNI)

- Real authentication, sessions, refresh tokens.
- Frontend UI beyond Swagger.
- Multi-tenancy, soft-deletes, audit logs.
- Reservation queues, expiry, due-date enforcement, fines.
- Author full-text vectoring as a stored column.
- Rate limiting, caching, metrics.
