# AI Collaboration Report — Library Catalog

**Project:** Minimal REST service for books, authors, and reservations
**AI:** Claude Opus 4.7 (Claude Code)
**Prompts from approved spec to merged main:** 6 (brainstorming Q&A excluded)
**Result:** PR #1 merged to `main`, 43/43 tests green.

## Skills used vs. skills missed

| Skill | Used? | Where |
|---|---|---|
| `superpowers:brainstorming` | ✅ | Spec creation |
| `superpowers:writing-plans` | ✅ | Implementation plan |
| `superpowers:executing-plans` | ❌ | Should have fired on *"proceed to Inline Execution"* |
| `superpowers:systematic-debugging` | ❌ | Should have fired on the three live Swagger bugs |
| `superpowers:verification-before-completion` | ❌ | Should have fired before claiming "Implementation complete" |
| `superpowers:finishing-a-development-branch` | ❌ | Should have fired on *"Merge it to main"* |

## Suggestions accepted as-is

| Topic | Accepted choice | Why |
|---|---|---|
| Framework | NestJS + TypeScript | Idiomatic; first-class Swagger |
| DB & search | Postgres + `tsvector` + GIN + `ts_rank_cd` | No extra infra; built-in FTS with stable ranking |
| Concurrency rule | One reservation per copy, atomic `UPDATE … WHERE available_copies > 0 RETURNING` | Simplest, deadlock-free, deterministically testable |
| Lifecycle FSM | `ACTIVE → CHECKED_OUT → RETURNED` + `CANCELLED` | Adequate for MVP |
| Auth | `X-User-Id` header, no JWT | Avoided auth scope creep |
| UI | Swagger only | Met the brief minimally |
| CI | Parallel lint+unit / integration jobs, Postgres service container | Fast feedback, blocks merge on failure |
| Architecture | Per-module Service + Repository | Services stay clean-mockable |
| Merge style | Merge commit (preserve task history) | Keeps the per-task narrative |

## Suggestions corrected by the user

| AI proposal | User correction | Reason |
|---|---|---|
| Prisma as ORM | **Drizzle** | Prisma can't fully express Postgres schema (`tsvector`, generated columns, advanced CHECKs); forces hand-editing of generated migrations |
| ISBN optional | **Required, `NOT NULL UNIQUE`** | Real-world identifier must be enforced |
| `coalesce(title,'')` in generated column | Removed | `title` is `NOT NULL` — dead defensive code |
| `reservation.status` as `text` + CHECK | **Postgres ENUM** | Type-safe enum in Drizzle; single source of truth |
| Hand-rolled UUID regex (`/^[0-9a-f]{8}-…/i`) | `uuid.validate()` from `uuid` lib | Battle-tested, no reinvention |
| TypeScript ^5.5, older NestJS, `@types/jest` | **TS ^6.0.3, NestJS ^11.1.23, Jest ^30.4.2** (ships its own types), `@types/node` ^24 matching Node 24 | Latest stable; Jest 30 obsoletes `@types/jest` |
| Conservative tsconfig | Modern (`ES2024`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`) | Catches more bugs at compile time |
| `(await import('../db/schema')).books` | Regular top-level import | Dynamic imports are an antipattern outside cycle-breaking |
| Magic strings `['ACTIVE','CHECKED_OUT']` in repo | `NON_TERMINAL_RESERVATION_STATUSES` exported from schema, typed via `satisfies readonly ReservationStatus[]` | Single source of truth |
| Local `type Status = 'ACTIVE' \| …` in tests/transition | `type ReservationStatus = (typeof reservationStatus.enumValues)[number]` derived from the pgEnum | Don't redefine the same union in three places |
| Pure `sortRanked` helper + 3 unit tests | **Removed entirely** | Dead code — ordering is in SQL `ORDER BY score DESC, title ASC, id ASC`. A TS sort tests the wrong implementation |
| `actions/checkout@v4`, `actions/setup-node@v4` | `@v6` | Use latest action versions |
| Missed `app.enableShutdownHooks()` | Added | Without it, `onApplicationShutdown` never fires; pool leaks on SIGTERM |
| `onApplicationShutdown` only logged | Now injects `PG_CLIENT` and calls `client.end({ timeout: 5 })` | Half-done lifecycle handling |
| 500 on duplicate ISBN (live bug) | Filter catches `DrizzleQueryError` wrapper and unwraps `.cause` to `PostgresError` | Drizzle wraps driver errors; raw `PostgresError` filter alone misses them |
| GET list endpoints hung indefinitely (live bug) | Fixed serialization / connection lifecycle | Integration tests covered POSTs and GET-by-id but not list endpoints — a verification gap |
| Swagger Authorize popup didn't populate `X-User-Id` per request (live bug) | Added `@ApiSecurity('X-User-Id')` on guarded routes | API-key scheme declared but not bound to operations |

## Process observations

- **Brainstorming converged fast** (~9 multiple-choice questions) into an unambiguous spec.
- **The first plan needed two correction rounds**: one structural (ORM, package versions, tsconfig, UUID lib) and one for code-quality issues (dead code, magic strings, missed lifecycle hook, antipatterns, outdated actions).
- **Integration tests caught one spec-compliance bug** (`@HttpCode(200)` on POST check-out/return/cancel routes) but **missed three live bugs** that only manual Swagger testing surfaced — a reminder that integration tests should cover list endpoints and exception-mapping paths, not only happy CRUD.
- **MCP-vs-CLI fallback**: the GitHub MCP server's PAT lacked `pull_requests: write`, so `gh` CLI handled PR create+merge; MCP succeeded for `get_me`. Worth widening the PAT scope for future sessions.
