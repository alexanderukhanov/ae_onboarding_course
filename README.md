# Library Catalog

A minimal REST service for managing books, authors, and reservations.
Built with NestJS, Drizzle ORM, and PostgreSQL 18.4. Full-text book
search via Postgres `tsvector` with `ts_rank_cd`-based ranking.

## Quick start

```bash
nvm use                       # Node 24.16.0
docker compose up -d db       # Postgres 18.4 on localhost:5432
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run start:dev             # http://localhost:3000/api/docs
```

## Tests

- `npm run test:unit` — Jest unit tests (no DB). 31 specs.
- `npm run test:integration` — Jest + supertest against a real
  Postgres. Reservation lifecycle, concurrent reservation race, and
  search ranking acceptance cases.

The integration tests expect a `library_test` database:

```bash
docker compose exec db psql -U library -d postgres -c "CREATE DATABASE library_test"
DATABASE_URL=postgresql://library:library@localhost:5432/library_test \
  npm run db:migrate
```

## Reservation concurrency rule

A book has N copies. At most N **ACTIVE or CHECKED_OUT** reservations
can exist for that book at once. Concurrent attempts on the last copy
are serialised by a single atomic SQL:

```sql
UPDATE books
   SET available_copies = available_copies - 1
 WHERE id = $1::uuid
   AND available_copies > 0
RETURNING id
```

Exactly one of N concurrent requests wins (201 Created); the rest
receive 409 Conflict. Verified by `reservation-concurrent.e2e-spec.ts`.

## Required status checks (one-time setup)

On GitHub, **Settings → Branches → Add rule** for `main`:

- Require pull request reviews before merging.
- Require status checks to pass before merging.
- Required checks: `lint-and-unit`, `integration`.
- Require branches to be up to date.

This blocks merging when the CI workflow fails.

## Notable design decisions

- **Drizzle ORM** with schema-first declaration. The `tsvector`
  generated column, GIN index, and CHECK constraints are all
  expressed in `db/schema.ts` and emitted by `drizzle-kit generate`
  with no hand-edits.
- **Single source of truth** for `ReservationStatus`: derived from
  the `reservationStatus` pgEnum in `db/schema.ts`. The
  `NON_TERMINAL_RESERVATION_STATUSES` constant is exported from the
  same file. No magic strings in feature modules.
- **Repository pattern** per module (Service + Repository) so
  services stay cleanly unit-testable with mocked repositories.
  Repositories are exercised by integration tests against a real DB.
- `DbModule` closes the Postgres pool in `onApplicationShutdown`;
  `app.enableShutdownHooks()` in `main.ts` is what fires it.
