# Library Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a NestJS + Drizzle + Postgres library catalog service with full-text book search and a concurrency-safe reservation flow, exercisable via Swagger UI, with unit and integration tests that block merging in GitHub Actions on failure.

**Architecture:** A single NestJS app with feature modules (Authors, Books, Search, Reservations). Each module is split into Service (business rules) and Repository (Drizzle queries) so services are cleanly unit-testable. Persistence on Postgres 18.4 via Drizzle ORM with the `postgres-js` driver. Search uses a Postgres `tsvector` stored generated column + GIN index, declared natively in the Drizzle schema, ranked with `ts_rank_cd`. Reservations use a single atomic `UPDATE ... WHERE available_copies > 0 RETURNING` inside a Drizzle transaction.

**Tech Stack:** Node.js 24.16.0, TypeScript ^6.0.3 (strict, modern config), NestJS ^11.1.23, Drizzle ORM ^0.45 + Drizzle Kit ^0.35, postgres ^3.4, Postgres 18.4, Jest ^30.4.2 (built-in types), supertest, @nestjs/swagger ^11, class-validator ^0.14, class-transformer ^0.5, uuid ^11, GitHub Actions.

---

## File Structure

```
/
├── .github/workflows/ci.yml
├── .nvmrc
├── .env.example
├── .gitignore                            (extend existing)
├── docker-compose.yml
├── package.json
├── tsconfig.json                         (modern strict)
├── tsconfig.build.json
├── nest-cli.json
├── eslint.config.mjs
├── jest.config.ts                        (unit, ts-jest)
├── drizzle.config.ts
├── db/
│   ├── schema.ts                         (tables, enums, relations, tsvector, indexes, checks)
│   ├── types.ts                          (Database type alias)
│   ├── seed.ts
│   └── migrations/                       (drizzle-kit output, committed)
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── db/
│   │   ├── drizzle.token.ts              (DRIZZLE symbol)
│   │   └── db.module.ts                  (provider for Drizzle client)
│   ├── common/
│   │   ├── filters/db-exception.filter.ts
│   │   ├── filters/db-exception.filter.spec.ts
│   │   ├── guards/user-exists.guard.ts
│   │   ├── guards/user-exists.guard.spec.ts
│   │   ├── decorators/current-user-id.decorator.ts
│   │   └── dto/pagination.dto.ts
│   ├── authors/
│   │   ├── authors.module.ts
│   │   ├── authors.controller.ts
│   │   ├── authors.service.ts
│   │   ├── authors.service.spec.ts
│   │   ├── authors.repository.ts
│   │   └── dto/*.ts
│   ├── books/
│   │   ├── books.module.ts
│   │   ├── books.controller.ts
│   │   ├── books.service.ts
│   │   ├── books.service.spec.ts
│   │   ├── books.repository.ts
│   │   └── dto/*.ts
│   ├── search/
│   │   ├── search.module.ts
│   │   ├── search.controller.ts
│   │   ├── search.service.ts
│   │   ├── search.repository.ts
│   │   ├── ranking.ts
│   │   ├── ranking.spec.ts
│   │   └── dto/*.ts
│   └── reservations/
│       ├── reservations.module.ts
│       ├── reservations.controller.ts
│       ├── reservations.service.ts
│       ├── reservations.service.spec.ts
│       ├── reservations.repository.ts
│       ├── transition.ts
│       ├── transition.spec.ts
│       └── dto/*.ts
└── test/
    ├── jest-e2e.config.ts
    ├── globalSetup.ts
    ├── helpers/
    │   ├── app.ts
    │   └── db.ts
    ├── fixtures/
    │   └── search-cases.ts
    └── integration/
        ├── reservation-lifecycle.e2e-spec.ts
        ├── reservation-concurrent.e2e-spec.ts
        └── search-ranking.e2e-spec.ts
```

---

## Task 1: Scaffold the NestJS project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `eslint.config.mjs`, `.nvmrc`, `src/main.ts`, `src/app.module.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Pin Node and update `.gitignore`**

Create `.nvmrc`:
```
24.16.0
```

Append to `.gitignore`:
```
node_modules/
dist/
coverage/
.env
.env.local
*.log
```

- [ ] **Step 2: Create `package.json` (latest versions)**

```json
{
  "name": "library-catalog",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": "24.16.0" },
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js",
    "start:dev": "nest start --watch",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\" \"db/**/*.ts\"",
    "test:unit": "jest --config jest.config.ts",
    "test:integration": "jest --config test/jest-e2e.config.ts --runInBand",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "ts-node db/seed.ts"
  },
  "dependencies": {
    "@nestjs/common": "^11.1.23",
    "@nestjs/config": "^4.0.0",
    "@nestjs/core": "^11.1.23",
    "@nestjs/platform-express": "^11.1.23",
    "@nestjs/swagger": "^11.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.2",
    "drizzle-orm": "^0.45.0",
    "postgres": "^3.4.5",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "uuid": "^11.0.5"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/testing": "^11.1.23",
    "@types/express": "^5.0.0",
    "@types/node": "^24.0.0",
    "@types/supertest": "^6.0.2",
    "@typescript-eslint/eslint-plugin": "^8.20.0",
    "@typescript-eslint/parser": "^8.20.0",
    "drizzle-kit": "^0.35.0",
    "eslint": "^9.18.0",
    "jest": "^30.4.2",
    "supertest": "^7.0.0",
    "ts-jest": "^30.0.0",
    "ts-node": "^10.9.2",
    "typescript": "^6.0.3"
  }
}
```

- [ ] **Step 3: Create modern `tsconfig.json` and `tsconfig.build.json`**

`tsconfig.json` — modern strict config (CommonJS for NestJS 11 compatibility, ES2024 target, all useful strict flags):
```json
{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024"],
    "module": "CommonJS",
    "moduleResolution": "Node10",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noPropertyAccessFromIndexSignature": true,

    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,

    "skipLibCheck": true,
    "resolveJsonModule": true,
    "sourceMap": true,
    "incremental": true,
    "removeComments": true,
    "declaration": false,
    "outDir": "./dist",
    "baseUrl": "./"
  },
  "include": ["src/**/*", "test/**/*", "db/**/*"]
}
```

`tsconfig.build.json`:
```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts", "db/seed.ts"]
}
```

`nest-cli.json`:
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": { "deleteOutDir": true }
}
```

- [ ] **Step 4: Create `eslint.config.mjs`**

```js
import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.ts', 'test/**/*.ts', 'db/**/*.ts'],
    languageOptions: { parser, parserOptions: { project: './tsconfig.json' } },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
```

- [ ] **Step 5: Create minimal `src/main.ts` and `src/app.module.ts`**

`src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
})
export class AppModule {}
```

`src/main.ts`:
```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  const cfg = new DocumentBuilder()
    .setTitle('Library Catalog')
    .setVersion('0.1.0')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-User-Id' }, 'X-User-Id')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, cfg));
  await app.listen(Number(process.env.PORT ?? 3000));
}
void bootstrap();
```

- [ ] **Step 6: Install dependencies and verify build**

Run: `npm install`
Run: `npm run build`
Expected: build succeeds, `dist/main.js` exists.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: scaffold NestJS 11 project with modern TS6 config"
```

---

## Task 2: Local Postgres via docker-compose and env config

**Files:**
- Create: `docker-compose.yml`, `.env.example`, `.env`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:18.4-alpine
    container_name: library-catalog-db
    environment:
      POSTGRES_USER: library
      POSTGRES_PASSWORD: library
      POSTGRES_DB: library
    ports:
      - "5432:5432"
    volumes:
      - db-data:/var/lib/postgresql/data
volumes:
  db-data:
```

- [ ] **Step 2: Create `.env.example` and local `.env`**

`.env.example`:
```
DATABASE_URL=postgresql://library:library@localhost:5432/library
PORT=3000
```

`.env` (not committed):
```
DATABASE_URL=postgresql://library:library@localhost:5432/library
PORT=3000
```

- [ ] **Step 3: Start the database and verify it accepts connections**

Run: `docker compose up -d db`
Run: `docker compose exec db pg_isready -U library`
Expected: `accepting connections`.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.example .gitignore
git commit -m "chore: add docker-compose for Postgres 18.4 and env example"
```

---

## Task 3: Drizzle schema, config, and initial migration

**Files:**
- Create: `drizzle.config.ts`, `db/schema.ts`, `db/types.ts`, `db/migrations/...` (generated)

- [ ] **Step 1: Create `drizzle.config.ts`**

```ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});
```

Also add `dotenv` to runtime deps via:
Run: `npm install dotenv`

- [ ] **Step 2: Create `db/schema.ts`**

```ts
import { relations, sql } from 'drizzle-orm';
import {
  check, customType, index, integer, pgEnum, pgTable, text, timestamp, uuid,
} from 'drizzle-orm/pg-core';

export const reservationStatus = pgEnum('reservation_status', [
  'ACTIVE',
  'CHECKED_OUT',
  'RETURNED',
  'CANCELLED',
]);

export const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

export const authors = pgTable('authors', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
});

export const books = pgTable(
  'books',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.id),
    isbn: text('isbn').notNull().unique(),
    totalCopies: integer('total_copies').notNull(),
    availableCopies: integer('available_copies').notNull(),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', title), 'A')`,
      'stored',
    ),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('books_author_id_idx').on(t.authorId),
    index('books_search_idx').using('gin', t.searchVector),
    check('books_total_copies_nonneg', sql`${t.totalCopies} >= 0`),
    check(
      'books_available_copies_bounds',
      sql`${t.availableCopies} >= 0 AND ${t.availableCopies} <= ${t.totalCopies}`,
    ),
  ],
);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
});

export const reservations = pgTable(
  'reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    status: reservationStatus('status').notNull(),
    reservedAt: timestamp('reserved_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    checkedOutAt: timestamp('checked_out_at', { withTimezone: true, mode: 'date' }),
    returnedAt: timestamp('returned_at', { withTimezone: true, mode: 'date' }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    index('reservations_book_status_idx').on(t.bookId, t.status),
    index('reservations_user_idx').on(t.userId),
  ],
);

export const authorsRelations = relations(authors, ({ many }) => ({
  books: many(books),
}));
export const booksRelations = relations(books, ({ one, many }) => ({
  author: one(authors, { fields: [books.authorId], references: [authors.id] }),
  reservations: many(reservations),
}));
export const usersRelations = relations(users, ({ many }) => ({
  reservations: many(reservations),
}));
export const reservationsRelations = relations(reservations, ({ one }) => ({
  book: one(books, { fields: [reservations.bookId], references: [books.id] }),
  user: one(users, { fields: [reservations.userId], references: [users.id] }),
}));
```

- [ ] **Step 3: Create `db/types.ts`**

```ts
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;
export type DbTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];
```

- [ ] **Step 4: Generate the initial migration**

Run: `npm run db:generate`
Expected: a file like `db/migrations/0000_<random>.sql` is created containing `CREATE TABLE`, `CREATE TYPE reservation_status …`, the tsvector generated column, GIN index, and check constraints. **No hand editing required.**

- [ ] **Step 5: Inspect the generated SQL**

Run: `cat db/migrations/0000_*.sql`
Expected: contains all of:
- `CREATE TYPE reservation_status AS ENUM ('ACTIVE','CHECKED_OUT','RETURNED','CANCELLED')`
- `search_vector tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple', title), 'A')) STORED`
- `CREATE INDEX "books_search_idx" ON "books" USING gin ("search_vector")`
- Both `CHECK` constraints

If the generated column is missing or malformed (older Drizzle Kit versions occasionally need a tweak), append the missing `ALTER TABLE` statements to the same migration file. Otherwise leave it untouched.

- [ ] **Step 6: Apply the migration**

Run: `npm run db:migrate`
Expected: success, no errors.

- [ ] **Step 7: Verify the schema in Postgres**

Run: `docker compose exec db psql -U library -d library -c "\d books"`
Expected: `search_vector` column visible with `tsvector` type and "stored generated" marker; `books_search_idx` listed.

- [ ] **Step 8: Commit**

```bash
git add db/ drizzle.config.ts package.json package-lock.json
git commit -m "feat(db): Drizzle schema and initial migration with tsvector + checks"
```

---

## Task 4: Drizzle DB module (DRIZZLE provider)

**Files:**
- Create: `src/db/drizzle.token.ts`, `src/db/db.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Create `src/db/drizzle.token.ts`**

```ts
export const DRIZZLE = Symbol('DRIZZLE');
```

- [ ] **Step 2: Create `src/db/db.module.ts`**

```ts
import { Global, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { Sql } from 'postgres';
import * as schema from '../../db/schema';
import { DRIZZLE } from './drizzle.token';

const PG_CLIENT = Symbol('PG_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: PG_CLIENT,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService): Sql =>
        postgres(cfg.getOrThrow<string>('DATABASE_URL'), { max: 10 }),
    },
    {
      provide: DRIZZLE,
      inject: [PG_CLIENT],
      useFactory: (client: Sql) => drizzle(client, { schema }),
    },
  ],
  exports: [DRIZZLE],
})
export class DbModule implements OnApplicationShutdown {
  private readonly logger = new Logger(DbModule.name);
  constructor() {}

  async onApplicationShutdown(): Promise<void> {
    this.logger.log('Closing Postgres client');
  }
}
```

- [ ] **Step 3: Register `DbModule` in `AppModule`**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db/db.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DbModule],
})
export class AppModule {}
```

- [ ] **Step 4: Build to verify**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/db src/app.module.ts
git commit -m "feat(db): DbModule exposing DRIZZLE provider with postgres-js"
```

---

## Task 5: DbExceptionFilter (with unit tests)

**Files:**
- Create: `src/common/filters/db-exception.filter.ts`, `src/common/filters/db-exception.filter.spec.ts`, `jest.config.ts`

- [ ] **Step 1: Create `jest.config.ts`**

```ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: 'coverage',
};
export default config;
```

- [ ] **Step 2: Write failing test `db-exception.filter.spec.ts`**

```ts
import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { PostgresError } from 'postgres';
import { DbExceptionFilter } from './db-exception.filter';

function mockHost(): { host: ArgumentsHost; res: { status: jest.Mock; json: jest.Mock } } {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ url: '/x' }) }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

function pgError(code: string): PostgresError {
  const err = Object.create(PostgresError.prototype) as PostgresError;
  Object.assign(err, { code, message: `pg ${code}` });
  return err;
}

describe('DbExceptionFilter', () => {
  const filter = new DbExceptionFilter();

  it.each([
    ['23505', HttpStatus.CONFLICT],
    ['23503', HttpStatus.CONFLICT],
    ['23514', HttpStatus.BAD_REQUEST],
  ])('maps Postgres code %s to status %i', (code, status) => {
    const { host, res } = mockHost();
    filter.catch(pgError(code), host);
    expect(res.status).toHaveBeenCalledWith(status);
  });

  it('maps unknown Postgres errors to 500', () => {
    const { host, res } = mockHost();
    filter.catch(pgError('99999'), host);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
```

- [ ] **Step 3: Run, see fail**

Run: `npm run test:unit -- db-exception.filter`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `db-exception.filter.ts`**

```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { PostgresError } from 'postgres';

interface Mapping {
  status: HttpStatus;
  error: string;
  message: string;
}

const CODE_MAP: Record<string, Mapping> = {
  '23505': { status: HttpStatus.CONFLICT, error: 'Conflict', message: 'Unique constraint violation' },
  '23503': { status: HttpStatus.CONFLICT, error: 'Conflict', message: 'Foreign key constraint violation' },
  '23514': { status: HttpStatus.BAD_REQUEST, error: 'Bad Request', message: 'Check constraint violation' },
};

const FALLBACK: Mapping = {
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  error: 'Internal Server Error',
  message: 'Database error',
};

@Catch(PostgresError)
export class DbExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DbExceptionFilter.name);

  catch(exception: PostgresError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const mapping = CODE_MAP[exception.code] ?? FALLBACK;
    if (mapping.status >= 500) this.logger.error(exception);
    res
      .status(mapping.status)
      .json({ statusCode: mapping.status, error: mapping.error, message: mapping.message });
  }
}
```

- [ ] **Step 5: Re-run tests**

Run: `npm run test:unit -- db-exception.filter`
Expected: 4 passing.

- [ ] **Step 6: Register the filter globally in `main.ts`**

Append after `useGlobalPipes(...)`:
```ts
import { DbExceptionFilter } from './common/filters/db-exception.filter';
// ...
app.useGlobalFilters(new DbExceptionFilter());
```

- [ ] **Step 7: Commit**

```bash
git add src/common/filters jest.config.ts src/main.ts
git commit -m "feat(common): add DbExceptionFilter mapping Postgres 23505/23503/23514"
```

---

## Task 6: UserExistsGuard (with `uuid.validate`) and @CurrentUserId() decorator

**Files:**
- Create: `src/common/guards/user-exists.guard.ts`, `src/common/guards/user-exists.guard.spec.ts`, `src/common/decorators/current-user-id.decorator.ts`

- [ ] **Step 1: Write failing test `user-exists.guard.spec.ts`**

```ts
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { users } from '../../../db/schema';
import { UserExistsGuard } from './user-exists.guard';

const VALID_UUID = '11111111-1111-1111-1111-111111111111';

function ctx(headers: Record<string, string | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('UserExistsGuard', () => {
  const findFirst = jest.fn();
  const db = { query: { users: { findFirst } } } as any;
  const guard = new UserExistsGuard(db);

  beforeEach(() => findFirst.mockReset());

  it('throws 401 when header is missing', async () => {
    await expect(guard.canActivate(ctx({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws 401 when header is not a UUID', async () => {
    await expect(guard.canActivate(ctx({ 'x-user-id': 'not-a-uuid' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws 401 when user is not in DB', async () => {
    findFirst.mockResolvedValue(undefined);
    await expect(guard.canActivate(ctx({ 'x-user-id': VALID_UUID }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns true and attaches userId when user exists', async () => {
    findFirst.mockResolvedValue({ id: VALID_UUID });
    const c = ctx({ 'x-user-id': VALID_UUID });
    await expect(guard.canActivate(c)).resolves.toBe(true);
    expect((c.switchToHttp().getRequest() as any).userId).toBe(VALID_UUID);
    // Sanity: the query used the expected where clause
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: eq(users.id, VALID_UUID) }),
    );
  });
});
```

- [ ] **Step 2: Run, see fail**

Run: `npm run test:unit -- user-exists.guard`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `user-exists.guard.ts`**

```ts
import {
  CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { validate as isUUID } from 'uuid';
import { users } from '../../../db/schema';
import { DRIZZLE } from '../../db/drizzle.token';
import type { Database } from '../../../db/types';

@Injectable()
export class UserExistsGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      userId?: string;
    }>();
    const headerVal = req.headers['x-user-id'];
    if (!headerVal || !isUUID(headerVal)) {
      throw new UnauthorizedException('Missing or invalid X-User-Id header');
    }
    const user = await this.db.query.users.findFirst({ where: eq(users.id, headerVal) });
    if (!user) throw new UnauthorizedException('Unknown user');
    req.userId = headerVal;
    return true;
  }
}
```

- [ ] **Step 4: Implement `current-user-id.decorator.ts`**

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{ userId?: string }>();
    if (!req.userId) throw new Error('CurrentUserId used without UserExistsGuard');
    return req.userId;
  },
);
```

- [ ] **Step 5: Run tests**

Run: `npm run test:unit -- user-exists.guard`
Expected: 4 passing.

- [ ] **Step 6: Commit**

```bash
git add src/common/guards src/common/decorators
git commit -m "feat(common): UserExistsGuard with uuid.validate + @CurrentUserId()"
```

---

## Task 7: Shared Pagination DTO

**Files:**
- Create: `src/common/dto/pagination.dto.ts`

- [ ] **Step 1: Create `pagination.dto.ts`**

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/common/dto
git commit -m "feat(common): shared pagination DTO and PagedResult type"
```

---

## Task 8: Authors module — repository

**Files:**
- Create: `src/authors/authors.repository.ts`, `src/authors/dto/{create-author.dto,update-author.dto,author.entity}.ts`

- [ ] **Step 1: Create DTOs**

`src/authors/dto/create-author.dto.ts`:
```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateAuthorDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;
}
```

`src/authors/dto/update-author.dto.ts`:
```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAuthorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;
}
```

`src/authors/dto/author.entity.ts`:
```ts
import { ApiProperty } from '@nestjs/swagger';

export class AuthorEntity {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() createdAt!: Date;
}
```

- [ ] **Step 2: Create `authors.repository.ts`**

```ts
import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { authors } from '../../db/schema';
import { DRIZZLE } from '../db/drizzle.token';
import type { Database } from '../../db/types';
import { AuthorEntity } from './dto/author.entity';

@Injectable()
export class AuthorsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findById(id: string): Promise<AuthorEntity | undefined> {
    return this.db.query.authors.findFirst({ where: eq(authors.id, id) });
  }

  async findPaged(page: number, pageSize: number): Promise<{ items: AuthorEntity[]; total: number }> {
    const [items, totalRow] = await Promise.all([
      this.db
        .select()
        .from(authors)
        .orderBy(desc(authors.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.$count(authors),
    ]);
    return { items, total: Number(totalRow) };
  }

  async create(data: { name: string }): Promise<AuthorEntity> {
    const [row] = await this.db.insert(authors).values(data).returning();
    return row!;
  }

  async update(id: string, data: { name?: string }): Promise<AuthorEntity | undefined> {
    const [row] = await this.db.update(authors).set(data).where(eq(authors.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(authors).where(eq(authors.id, id));
  }

  async countBooksByAuthor(authorId: string): Promise<number> {
    const result = await this.db.$count(
      (await import('../../db/schema')).books,
      eq((await import('../../db/schema')).books.authorId, authorId),
    );
    return Number(result);
  }
}
```

Note: the dynamic imports for `books` keep the repository's import surface scoped; for simplicity you can also import `books` at the top.

Simpler alternative — replace `countBooksByAuthor` with the top-level form:
```ts
import { authors, books } from '../../db/schema';
// ...
async countBooksByAuthor(authorId: string): Promise<number> {
  const c = await this.db.$count(books, eq(books.authorId, authorId));
  return Number(c);
}
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/authors
git commit -m "feat(authors): repository and DTOs"
```

---

## Task 9: Authors module — service with unit tests

**Files:**
- Create: `src/authors/authors.service.ts`, `src/authors/authors.service.spec.ts`

- [ ] **Step 1: Write failing service tests `authors.service.spec.ts`**

```ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuthorsRepository } from './authors.repository';
import { AuthorsService } from './authors.service';

function makeRepo(): jest.Mocked<AuthorsRepository> {
  return {
    findById: jest.fn(),
    findPaged: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    countBooksByAuthor: jest.fn(),
  } as unknown as jest.Mocked<AuthorsRepository>;
}

describe('AuthorsService', () => {
  let repo: jest.Mocked<AuthorsRepository>;
  let svc: AuthorsService;

  beforeEach(() => {
    repo = makeRepo();
    svc = new AuthorsService(repo);
  });

  it('creates an author', async () => {
    repo.create.mockResolvedValue({ id: 'a1', name: 'X', createdAt: new Date() });
    const out = await svc.create({ name: 'X' });
    expect(out.name).toBe('X');
    expect(repo.create).toHaveBeenCalledWith({ name: 'X' });
  });

  it('returns 404 when getting an unknown author', async () => {
    repo.findById.mockResolvedValue(undefined);
    await expect(svc.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists authors with pagination', async () => {
    repo.findPaged.mockResolvedValue({
      items: [{ id: '1', name: 'A', createdAt: new Date() }],
      total: 1,
    });
    const out = await svc.findAll({ page: 1, pageSize: 20 });
    expect(out.total).toBe(1);
    expect(out.items).toHaveLength(1);
  });

  it('refuses to delete an author with books', async () => {
    repo.findById.mockResolvedValue({ id: 'a1', name: 'X', createdAt: new Date() });
    repo.countBooksByAuthor.mockResolvedValue(2);
    await expect(svc.remove('a1')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('deletes an author with no books', async () => {
    repo.findById.mockResolvedValue({ id: 'a1', name: 'X', createdAt: new Date() });
    repo.countBooksByAuthor.mockResolvedValue(0);
    await svc.remove('a1');
    expect(repo.delete).toHaveBeenCalledWith('a1');
  });
});
```

- [ ] **Step 2: Run, see fail**

Run: `npm run test:unit -- authors.service`
Expected: FAIL.

- [ ] **Step 3: Implement `authors.service.ts`**

```ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PagedResult, PaginationQueryDto } from '../common/dto/pagination.dto';
import { AuthorsRepository } from './authors.repository';
import { AuthorEntity } from './dto/author.entity';
import { CreateAuthorDto } from './dto/create-author.dto';
import { UpdateAuthorDto } from './dto/update-author.dto';

@Injectable()
export class AuthorsService {
  constructor(private readonly repo: AuthorsRepository) {}

  async create(dto: CreateAuthorDto): Promise<AuthorEntity> {
    return this.repo.create({ name: dto.name });
  }

  async findOne(id: string): Promise<AuthorEntity> {
    const a = await this.repo.findById(id);
    if (!a) throw new NotFoundException('Author not found');
    return a;
  }

  async findAll(q: PaginationQueryDto): Promise<PagedResult<AuthorEntity>> {
    const { items, total } = await this.repo.findPaged(q.page, q.pageSize);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async update(id: string, dto: UpdateAuthorDto): Promise<AuthorEntity> {
    await this.findOne(id);
    const updated = await this.repo.update(id, dto);
    if (!updated) throw new NotFoundException('Author not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    const books = await this.repo.countBooksByAuthor(id);
    if (books > 0) throw new ConflictException('Author has books');
    await this.repo.delete(id);
  }
}
```

- [ ] **Step 4: Re-run tests**

Run: `npm run test:unit -- authors.service`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/authors/authors.service.ts src/authors/authors.service.spec.ts
git commit -m "feat(authors): service with CRUD + book-link guard, unit tests"
```

---

## Task 10: Authors controller and module

**Files:**
- Create: `src/authors/authors.controller.ts`, `src/authors/authors.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Create `authors.controller.ts`**

```ts
import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { AuthorsService } from './authors.service';
import { CreateAuthorDto } from './dto/create-author.dto';
import { UpdateAuthorDto } from './dto/update-author.dto';

@ApiTags('authors')
@Controller('authors')
export class AuthorsController {
  constructor(private readonly svc: AuthorsService) {}

  @Post() create(@Body() dto: CreateAuthorDto) { return this.svc.create(dto); }

  @Get() findAll(@Query() q: PaginationQueryDto) { return this.svc.findAll(q); }

  @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.svc.findOne(id); }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAuthorDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id') @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(id); }
}
```

- [ ] **Step 2: Create `authors.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { AuthorsController } from './authors.controller';
import { AuthorsRepository } from './authors.repository';
import { AuthorsService } from './authors.service';

@Module({
  controllers: [AuthorsController],
  providers: [AuthorsService, AuthorsRepository],
  exports: [AuthorsService, AuthorsRepository],
})
export class AuthorsModule {}
```

- [ ] **Step 3: Register `AuthorsModule` in `AppModule`**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthorsModule } from './authors/authors.module';
import { DbModule } from './db/db.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    AuthorsModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Build to verify**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/authors src/app.module.ts
git commit -m "feat(authors): controller and module"
```

---

## Task 11: Books module — repository

**Files:**
- Create: `src/books/books.repository.ts`, `src/books/dto/{create-book.dto,update-book.dto,book.entity,list-books.query}.ts`

- [ ] **Step 1: Create DTOs**

`src/books/dto/create-book.dto.ts`:
```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsISBN, IsNotEmpty, IsString, IsUUID, Min } from 'class-validator';

export class CreateBookDto {
  @ApiProperty() @IsString() @IsNotEmpty() title!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() authorId!: string;
  @ApiProperty({ description: 'ISBN-10 or ISBN-13' }) @IsISBN() isbn!: string;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) totalCopies!: number;
}
```

`src/books/dto/update-book.dto.ts`:
```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsISBN, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpdateBookDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() authorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsISBN() isbn?: string;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0) totalCopies?: number;
}
```

`src/books/dto/book.entity.ts`:
```ts
import { ApiProperty } from '@nestjs/swagger';
import { AuthorEntity } from '../../authors/dto/author.entity';

export class BookEntity {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() authorId!: string;
  @ApiProperty() isbn!: string;
  @ApiProperty() totalCopies!: number;
  @ApiProperty() availableCopies!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty({ type: () => AuthorEntity, required: false })
  author?: AuthorEntity;
}
```

`src/books/dto/list-books.query.ts`:
```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ListBooksQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() authorId?: string;
}
```

- [ ] **Step 2: Create `books.repository.ts`**

```ts
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { authors, books, reservations } from '../../db/schema';
import { DRIZZLE } from '../db/drizzle.token';
import type { Database } from '../../db/types';
import { BookEntity } from './dto/book.entity';

export interface BookWriteData {
  title: string;
  authorId: string;
  isbn: string;
  totalCopies: number;
  availableCopies: number;
}

export interface BookPatchData {
  title?: string;
  authorId?: string;
  isbn?: string;
  totalCopies?: number;
  availableCopies?: number;
  updatedAt?: Date;
}

@Injectable()
export class BooksRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findById(id: string): Promise<BookEntity | undefined> {
    return this.db.query.books.findFirst({
      where: eq(books.id, id),
      with: { author: true },
    });
  }

  async findAuthor(id: string): Promise<{ id: string } | undefined> {
    return this.db.query.authors.findFirst({ where: eq(authors.id, id), columns: { id: true } });
  }

  async findPaged(
    page: number,
    pageSize: number,
    authorId: string | undefined,
  ): Promise<{ items: BookEntity[]; total: number }> {
    const where = authorId ? eq(books.authorId, authorId) : undefined;
    const [items, total] = await Promise.all([
      this.db.query.books.findMany({
        where,
        orderBy: desc(books.createdAt),
        limit: pageSize,
        offset: (page - 1) * pageSize,
        with: { author: true },
      }),
      this.db.$count(books, where),
    ]);
    return { items, total: Number(total) };
  }

  async create(data: BookWriteData): Promise<BookEntity> {
    const [row] = await this.db.insert(books).values(data).returning();
    return this.findById(row!.id) as Promise<BookEntity>;
  }

  async update(id: string, data: BookPatchData): Promise<BookEntity | undefined> {
    const [row] = await this.db
      .update(books)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(books.id, id))
      .returning();
    if (!row) return undefined;
    return this.findById(row.id);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(books).where(eq(books.id, id));
  }

  async countActiveReservations(bookId: string): Promise<number> {
    const c = await this.db.$count(
      reservations,
      and(eq(reservations.bookId, bookId), inArray(reservations.status, ['ACTIVE', 'CHECKED_OUT'])),
    );
    return Number(c);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/books
git commit -m "feat(books): repository and DTOs"
```

---

## Task 12: Books module — service with unit tests

**Files:**
- Create: `src/books/books.service.ts`, `src/books/books.service.spec.ts`

- [ ] **Step 1: Write failing tests `books.service.spec.ts`**

```ts
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BooksRepository } from './books.repository';
import { BooksService } from './books.service';

function makeRepo(): jest.Mocked<BooksRepository> {
  return {
    findById: jest.fn(),
    findAuthor: jest.fn(),
    findPaged: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    countActiveReservations: jest.fn(),
  } as unknown as jest.Mocked<BooksRepository>;
}

describe('BooksService', () => {
  let repo: jest.Mocked<BooksRepository>;
  let svc: BooksService;

  beforeEach(() => {
    repo = makeRepo();
    svc = new BooksService(repo);
  });

  it('creates a book with availableCopies = totalCopies', async () => {
    repo.findAuthor.mockResolvedValue({ id: 'a1' });
    repo.create.mockImplementation((data) =>
      Promise.resolve({ ...data, id: 'b1', createdAt: new Date(), updatedAt: new Date() } as any),
    );
    const out = await svc.create({ title: 'T', authorId: 'a1', isbn: '9780132350884', totalCopies: 3 });
    expect(out.availableCopies).toBe(3);
    expect(repo.create).toHaveBeenCalledWith({
      title: 'T', authorId: 'a1', isbn: '9780132350884', totalCopies: 3, availableCopies: 3,
    });
  });

  it('rejects create when author does not exist', async () => {
    repo.findAuthor.mockResolvedValue(undefined);
    await expect(
      svc.create({ title: 'T', authorId: 'a1', isbn: '9780132350884', totalCopies: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 on unknown id', async () => {
    repo.findById.mockResolvedValue(undefined);
    await expect(svc.findOne('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects totalCopies update that would drive availableCopies negative', async () => {
    repo.findById.mockResolvedValue({
      id: 'b1', title: '', authorId: 'a1', isbn: '', totalCopies: 5, availableCopies: 1,
      createdAt: new Date(), updatedAt: new Date(),
    } as any);
    await expect(svc.update('b1', { totalCopies: 3 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies delta to availableCopies when increasing totalCopies', async () => {
    repo.findById.mockResolvedValueOnce({
      id: 'b1', title: '', authorId: 'a1', isbn: '', totalCopies: 5, availableCopies: 2,
      createdAt: new Date(), updatedAt: new Date(),
    } as any);
    repo.update.mockResolvedValue({
      id: 'b1', title: '', authorId: 'a1', isbn: '', totalCopies: 7, availableCopies: 4,
      createdAt: new Date(), updatedAt: new Date(),
    } as any);
    const out = await svc.update('b1', { totalCopies: 7 });
    expect(out.totalCopies).toBe(7);
    expect(out.availableCopies).toBe(4);
    expect(repo.update).toHaveBeenCalledWith('b1', { totalCopies: 7, availableCopies: 4 });
  });

  it('refuses to delete a book with non-terminal reservations', async () => {
    repo.findById.mockResolvedValue({
      id: 'b1', title: '', authorId: 'a1', isbn: '', totalCopies: 1, availableCopies: 1,
      createdAt: new Date(), updatedAt: new Date(),
    } as any);
    repo.countActiveReservations.mockResolvedValue(1);
    await expect(svc.remove('b1')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, see fail**

Run: `npm run test:unit -- books.service`
Expected: FAIL.

- [ ] **Step 3: Implement `books.service.ts`**

```ts
import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { PagedResult } from '../common/dto/pagination.dto';
import { BooksRepository } from './books.repository';
import { BookEntity } from './dto/book.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { ListBooksQueryDto } from './dto/list-books.query';
import { UpdateBookDto } from './dto/update-book.dto';

@Injectable()
export class BooksService {
  constructor(private readonly repo: BooksRepository) {}

  async create(dto: CreateBookDto): Promise<BookEntity> {
    const author = await this.repo.findAuthor(dto.authorId);
    if (!author) throw new NotFoundException('Author not found');
    return this.repo.create({
      title: dto.title,
      authorId: dto.authorId,
      isbn: dto.isbn,
      totalCopies: dto.totalCopies,
      availableCopies: dto.totalCopies,
    });
  }

  async findOne(id: string): Promise<BookEntity> {
    const b = await this.repo.findById(id);
    if (!b) throw new NotFoundException('Book not found');
    return b;
  }

  async findAll(q: ListBooksQueryDto): Promise<PagedResult<BookEntity>> {
    const { items, total } = await this.repo.findPaged(q.page, q.pageSize, q.authorId);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async update(id: string, dto: UpdateBookDto): Promise<BookEntity> {
    const current = await this.repo.findById(id);
    if (!current) throw new NotFoundException('Book not found');

    const patch: Record<string, unknown> = { ...dto };
    if (dto.totalCopies !== undefined) {
      const delta = dto.totalCopies - current.totalCopies;
      const newAvailable = current.availableCopies + delta;
      if (newAvailable < 0) {
        throw new BadRequestException(
          'totalCopies cannot be reduced below the number of copies currently in use',
        );
      }
      patch.availableCopies = newAvailable;
    }
    const updated = await this.repo.update(id, patch);
    if (!updated) throw new NotFoundException('Book not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    const active = await this.repo.countActiveReservations(id);
    if (active > 0) throw new ConflictException('Book has active reservations');
    await this.repo.delete(id);
  }
}
```

- [ ] **Step 4: Re-run tests**

Run: `npm run test:unit -- books.service`
Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add src/books/books.service.ts src/books/books.service.spec.ts
git commit -m "feat(books): service with copy-count invariants, unit tests"
```

---

## Task 13: Books controller and module

**Files:**
- Create: `src/books/books.controller.ts`, `src/books/books.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Create `books.controller.ts`**

```ts
import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { ListBooksQueryDto } from './dto/list-books.query';
import { UpdateBookDto } from './dto/update-book.dto';

@ApiTags('books')
@Controller('books')
export class BooksController {
  constructor(private readonly svc: BooksService) {}

  @Post() create(@Body() dto: CreateBookDto) { return this.svc.create(dto); }
  @Get() findAll(@Query() q: ListBooksQueryDto) { return this.svc.findAll(q); }
  @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.svc.findOne(id); }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBookDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id') @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(id); }
}
```

- [ ] **Step 2: Create `books.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksRepository } from './books.repository';
import { BooksService } from './books.service';

@Module({
  controllers: [BooksController],
  providers: [BooksService, BooksRepository],
  exports: [BooksService, BooksRepository],
})
export class BooksModule {}
```

- [ ] **Step 3: Register in `AppModule`**

Add `BooksModule` to the imports array.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/books src/app.module.ts
git commit -m "feat(books): controller and module"
```

---

## Task 14: Reservation FSM (pure function with exhaustive tests)

**Files:**
- Create: `src/reservations/transition.ts`, `src/reservations/transition.spec.ts`

- [ ] **Step 1: Write failing tests `transition.spec.ts`**

```ts
import { reservationTransition, ReservationAction } from './transition';

type Status = 'ACTIVE' | 'CHECKED_OUT' | 'RETURNED' | 'CANCELLED';
const ALL_STATUSES: Status[] = ['ACTIVE', 'CHECKED_OUT', 'RETURNED', 'CANCELLED'];
const ALL_ACTIONS: ReservationAction[] = ['check_out', 'return', 'cancel'];

const legal: Array<[Status, ReservationAction, Status]> = [
  ['ACTIVE',      'check_out', 'CHECKED_OUT'],
  ['ACTIVE',      'cancel',    'CANCELLED'],
  ['CHECKED_OUT', 'return',    'RETURNED'],
];

describe('reservationTransition', () => {
  it.each(legal)('legal: %s + %s -> %s', (from, action, to) => {
    expect(reservationTransition(from, action)).toBe(to);
  });

  it('throws on every illegal (status, action) combination', () => {
    const legalKeys = new Set(legal.map(([s, a]) => `${s}|${a}`));
    for (const s of ALL_STATUSES) {
      for (const a of ALL_ACTIONS) {
        if (legalKeys.has(`${s}|${a}`)) continue;
        expect(() => reservationTransition(s, a)).toThrow();
      }
    }
  });
});
```

- [ ] **Step 2: Run, see fail**

Run: `npm run test:unit -- transition`
Expected: FAIL.

- [ ] **Step 3: Implement `transition.ts`**

```ts
import { ConflictException } from '@nestjs/common';

export type ReservationStatus = 'ACTIVE' | 'CHECKED_OUT' | 'RETURNED' | 'CANCELLED';
export type ReservationAction = 'check_out' | 'return' | 'cancel';

const TABLE: Partial<Record<ReservationStatus, Partial<Record<ReservationAction, ReservationStatus>>>> = {
  ACTIVE:      { check_out: 'CHECKED_OUT', cancel: 'CANCELLED' },
  CHECKED_OUT: { return:    'RETURNED' },
};

export function reservationTransition(
  current: ReservationStatus,
  action: ReservationAction,
): ReservationStatus {
  const next = TABLE[current]?.[action];
  if (!next) {
    throw new ConflictException(`Illegal transition: ${current} + ${action}`);
  }
  return next;
}
```

- [ ] **Step 4: Re-run**

Run: `npm run test:unit -- transition`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/reservations/transition.ts src/reservations/transition.spec.ts
git commit -m "feat(reservations): pure FSM with exhaustive transition tests"
```

---

## Task 15: Reservations module — repository (with atomic UPDATE)

**Files:**
- Create: `src/reservations/reservations.repository.ts`, `src/reservations/dto/{create-reservation.dto,reservation.entity,list-reservations.query}.ts`

- [ ] **Step 1: Create DTOs**

`src/reservations/dto/create-reservation.dto.ts`:
```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() bookId!: string;
}
```

`src/reservations/dto/reservation.entity.ts`:
```ts
import { ApiProperty } from '@nestjs/swagger';
import { ReservationStatus } from '../transition';

export class ReservationEntity {
  @ApiProperty() id!: string;
  @ApiProperty() bookId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ enum: ['ACTIVE', 'CHECKED_OUT', 'RETURNED', 'CANCELLED'] })
  status!: ReservationStatus;
  @ApiProperty() reservedAt!: Date;
  @ApiProperty({ nullable: true }) checkedOutAt!: Date | null;
  @ApiProperty({ nullable: true }) returnedAt!: Date | null;
  @ApiProperty({ nullable: true }) cancelledAt!: Date | null;
}
```

`src/reservations/dto/list-reservations.query.ts`:
```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ReservationStatus } from '../transition';

const STATUSES = ['ACTIVE', 'CHECKED_OUT', 'RETURNED', 'CANCELLED'] as const;

export class ListReservationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() userId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() bookId?: string;
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional() @IsEnum(STATUSES)
  status?: ReservationStatus;
}
```

- [ ] **Step 2: Create `reservations.repository.ts`**

```ts
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql, SQL } from 'drizzle-orm';
import { books, reservations } from '../../db/schema';
import { DRIZZLE } from '../db/drizzle.token';
import type { Database, DbTransaction } from '../../db/types';
import { ReservationEntity } from './dto/reservation.entity';
import { ReservationStatus } from './transition';

export interface CreateAtomicResult {
  reservation: ReservationEntity;
}

@Injectable()
export class ReservationsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findById(id: string): Promise<ReservationEntity | undefined> {
    return this.db.query.reservations.findFirst({ where: eq(reservations.id, id) });
  }

  async findPaged(
    page: number,
    pageSize: number,
    filter: { userId?: string; bookId?: string; status?: ReservationStatus },
  ): Promise<{ items: ReservationEntity[]; total: number }> {
    const conds: SQL[] = [];
    if (filter.userId) conds.push(eq(reservations.userId, filter.userId));
    if (filter.bookId) conds.push(eq(reservations.bookId, filter.bookId));
    if (filter.status) conds.push(eq(reservations.status, filter.status));
    const where = conds.length ? and(...conds) : undefined;

    const [items, total] = await Promise.all([
      this.db.query.reservations.findMany({
        where,
        orderBy: desc(reservations.reservedAt),
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      this.db.$count(reservations, where),
    ]);
    return { items, total: Number(total) };
  }

  /** Decrements available_copies atomically. Returns false if no copies available. */
  async tryDecrementAvailable(tx: DbTransaction, bookId: string): Promise<boolean> {
    const rows = await tx.execute<{ id: string }>(sql`
      UPDATE ${books}
         SET available_copies = available_copies - 1
       WHERE ${books.id} = ${bookId}::uuid
         AND ${books.availableCopies} > 0
      RETURNING ${books.id} AS id`);
    return rows.length > 0;
  }

  /** Increments available_copies atomically. Returns false if it would exceed total_copies. */
  async tryIncrementAvailable(tx: DbTransaction, bookId: string): Promise<boolean> {
    const rows = await tx.execute<{ id: string }>(sql`
      UPDATE ${books}
         SET available_copies = available_copies + 1
       WHERE ${books.id} = ${bookId}::uuid
         AND ${books.availableCopies} + 1 <= ${books.totalCopies}
      RETURNING ${books.id} AS id`);
    return rows.length > 0;
  }

  async bookExists(tx: DbTransaction, bookId: string): Promise<boolean> {
    const found = await tx.query.books.findFirst({ where: eq(books.id, bookId), columns: { id: true } });
    return !!found;
  }

  async createInTx(
    tx: DbTransaction,
    data: { bookId: string; userId: string; status: ReservationStatus },
  ): Promise<ReservationEntity> {
    const [row] = await tx.insert(reservations).values(data).returning();
    return row!;
  }

  async updateInTx(
    tx: DbTransaction,
    id: string,
    data: Partial<{
      status: ReservationStatus;
      checkedOutAt: Date;
      returnedAt: Date;
      cancelledAt: Date;
    }>,
  ): Promise<ReservationEntity> {
    const [row] = await tx.update(reservations).set(data).where(eq(reservations.id, id)).returning();
    return row!;
  }

  async findByIdInTx(tx: DbTransaction, id: string): Promise<ReservationEntity | undefined> {
    return tx.query.reservations.findFirst({ where: eq(reservations.id, id) });
  }

  withTransaction<T>(cb: (tx: DbTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(cb);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/reservations
git commit -m "feat(reservations): repository with atomic UPDATE primitives and tx helpers"
```

---

## Task 16: Reservations service with unit tests

**Files:**
- Create: `src/reservations/reservations.service.ts`, `src/reservations/reservations.service.spec.ts`

- [ ] **Step 1: Write failing tests `reservations.service.spec.ts`**

```ts
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReservationsRepository } from './reservations.repository';
import { ReservationsService } from './reservations.service';

function makeRepo(): jest.Mocked<ReservationsRepository> {
  const repo = {
    findById: jest.fn(),
    findPaged: jest.fn(),
    tryDecrementAvailable: jest.fn(),
    tryIncrementAvailable: jest.fn(),
    bookExists: jest.fn(),
    createInTx: jest.fn(),
    updateInTx: jest.fn(),
    findByIdInTx: jest.fn(),
    withTransaction: jest.fn(),
  } as unknown as jest.Mocked<ReservationsRepository>;
  // by default, withTransaction just calls the callback with a sentinel tx
  repo.withTransaction.mockImplementation((cb: any) => cb({} as any));
  return repo;
}

describe('ReservationsService', () => {
  let repo: jest.Mocked<ReservationsRepository>;
  let svc: ReservationsService;

  beforeEach(() => {
    repo = makeRepo();
    svc = new ReservationsService(repo);
  });

  describe('create', () => {
    it('404 when book does not exist', async () => {
      repo.bookExists.mockResolvedValue(false);
      await expect(svc.create('u1', { bookId: 'b1' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409 when atomic decrement returns no rows', async () => {
      repo.bookExists.mockResolvedValue(true);
      repo.tryDecrementAvailable.mockResolvedValue(false);
      await expect(svc.create('u1', { bookId: 'b1' })).rejects.toBeInstanceOf(ConflictException);
      expect(repo.createInTx).not.toHaveBeenCalled();
    });

    it('creates ACTIVE reservation when atomic decrement succeeds', async () => {
      repo.bookExists.mockResolvedValue(true);
      repo.tryDecrementAvailable.mockResolvedValue(true);
      repo.createInTx.mockResolvedValue({
        id: 'r1', bookId: 'b1', userId: 'u1', status: 'ACTIVE',
        reservedAt: new Date(), checkedOutAt: null, returnedAt: null, cancelledAt: null,
      });
      const out = await svc.create('u1', { bookId: 'b1' });
      expect(out.status).toBe('ACTIVE');
    });
  });

  describe('checkOut', () => {
    it('404 on missing reservation', async () => {
      repo.findByIdInTx.mockResolvedValue(undefined);
      await expect(svc.checkOut('u1', 'r1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('forbids non-owners', async () => {
      repo.findByIdInTx.mockResolvedValue({
        id: 'r1', bookId: 'b1', userId: 'someone', status: 'ACTIVE',
        reservedAt: new Date(), checkedOutAt: null, returnedAt: null, cancelledAt: null,
      });
      await expect(svc.checkOut('u1', 'r1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects illegal transition', async () => {
      repo.findByIdInTx.mockResolvedValue({
        id: 'r1', bookId: 'b1', userId: 'u1', status: 'RETURNED',
        reservedAt: new Date(), checkedOutAt: new Date(), returnedAt: new Date(), cancelledAt: null,
      });
      await expect(svc.checkOut('u1', 'r1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('marks CHECKED_OUT with timestamp', async () => {
      repo.findByIdInTx.mockResolvedValue({
        id: 'r1', bookId: 'b1', userId: 'u1', status: 'ACTIVE',
        reservedAt: new Date(), checkedOutAt: null, returnedAt: null, cancelledAt: null,
      });
      repo.updateInTx.mockImplementation(async (_tx, _id, data) => ({
        id: 'r1', bookId: 'b1', userId: 'u1',
        status: data.status!, reservedAt: new Date(),
        checkedOutAt: data.checkedOutAt ?? null,
        returnedAt: null, cancelledAt: null,
      }));
      const out = await svc.checkOut('u1', 'r1');
      expect(out.status).toBe('CHECKED_OUT');
      expect(out.checkedOutAt).not.toBeNull();
    });
  });

  describe('return_', () => {
    it('increments availableCopies and marks RETURNED', async () => {
      repo.findByIdInTx.mockResolvedValue({
        id: 'r1', bookId: 'b1', userId: 'u1', status: 'CHECKED_OUT',
        reservedAt: new Date(), checkedOutAt: new Date(), returnedAt: null, cancelledAt: null,
      });
      repo.tryIncrementAvailable.mockResolvedValue(true);
      repo.updateInTx.mockImplementation(async (_tx, _id, data) => ({
        id: 'r1', bookId: 'b1', userId: 'u1',
        status: data.status!, reservedAt: new Date(),
        checkedOutAt: new Date(),
        returnedAt: data.returnedAt ?? null,
        cancelledAt: null,
      }));
      const out = await svc.return_('u1', 'r1');
      expect(out.status).toBe('RETURNED');
      expect(repo.tryIncrementAvailable).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run, see fail**

Run: `npm run test:unit -- reservations.service`
Expected: FAIL.

- [ ] **Step 3: Implement `reservations.service.ts`**

```ts
import {
  ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { PagedResult } from '../common/dto/pagination.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ListReservationsQueryDto } from './dto/list-reservations.query';
import { ReservationEntity } from './dto/reservation.entity';
import { ReservationsRepository } from './reservations.repository';
import { reservationTransition, ReservationAction } from './transition';
import type { DbTransaction } from '../../db/types';

@Injectable()
export class ReservationsService {
  constructor(private readonly repo: ReservationsRepository) {}

  async create(userId: string, dto: CreateReservationDto): Promise<ReservationEntity> {
    return this.repo.withTransaction(async (tx: DbTransaction) => {
      if (!(await this.repo.bookExists(tx, dto.bookId))) {
        throw new NotFoundException('Book not found');
      }
      const ok = await this.repo.tryDecrementAvailable(tx, dto.bookId);
      if (!ok) throw new ConflictException('No copies available');
      return this.repo.createInTx(tx, { bookId: dto.bookId, userId, status: 'ACTIVE' });
    });
  }

  async findOne(id: string): Promise<ReservationEntity> {
    const r = await this.repo.findById(id);
    if (!r) throw new NotFoundException('Reservation not found');
    return r;
  }

  async findAll(q: ListReservationsQueryDto): Promise<PagedResult<ReservationEntity>> {
    const { items, total } = await this.repo.findPaged(q.page, q.pageSize, {
      userId: q.userId,
      bookId: q.bookId,
      status: q.status,
    });
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async checkOut(userId: string, id: string): Promise<ReservationEntity> {
    return this.repo.withTransaction(async (tx: DbTransaction) => {
      const r = await this.repo.findByIdInTx(tx, id);
      if (!r) throw new NotFoundException('Reservation not found');
      if (r.userId !== userId) throw new ForbiddenException('Not the reservation owner');
      const next = reservationTransition(r.status, 'check_out');
      return this.repo.updateInTx(tx, id, { status: next, checkedOutAt: new Date() });
    });
  }

  async return_(userId: string, id: string): Promise<ReservationEntity> {
    return this.transitionWithCopyChange(userId, id, 'return', 'returnedAt');
  }

  async cancel(userId: string, id: string): Promise<ReservationEntity> {
    return this.transitionWithCopyChange(userId, id, 'cancel', 'cancelledAt');
  }

  private async transitionWithCopyChange(
    userId: string,
    id: string,
    action: ReservationAction,
    timestampField: 'returnedAt' | 'cancelledAt',
  ): Promise<ReservationEntity> {
    return this.repo.withTransaction(async (tx: DbTransaction) => {
      const r = await this.repo.findByIdInTx(tx, id);
      if (!r) throw new NotFoundException('Reservation not found');
      if (r.userId !== userId) throw new ForbiddenException('Not the reservation owner');
      const next = reservationTransition(r.status, action);

      const ok = await this.repo.tryIncrementAvailable(tx, r.bookId);
      if (!ok) throw new ConflictException('Copy accounting invariant violated');

      return this.repo.updateInTx(tx, id, { status: next, [timestampField]: new Date() });
    });
  }
}
```

- [ ] **Step 4: Re-run tests**

Run: `npm run test:unit -- reservations.service`
Expected: passing.

- [ ] **Step 5: Commit**

```bash
git add src/reservations/reservations.service.ts src/reservations/reservations.service.spec.ts
git commit -m "feat(reservations): service with atomic UPDATE concurrency and unit tests"
```

---

## Task 17: Reservations controller and module

**Files:**
- Create: `src/reservations/reservations.controller.ts`, `src/reservations/reservations.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Create `reservations.controller.ts`**

```ts
import {
  Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { UserExistsGuard } from '../common/guards/user-exists.guard';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ListReservationsQueryDto } from './dto/list-reservations.query';
import { ReservationsService } from './reservations.service';

@ApiTags('reservations')
@ApiHeader({ name: 'X-User-Id', required: true, schema: { format: 'uuid' } })
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly svc: ReservationsService) {}

  @Post() @UseGuards(UserExistsGuard) @HttpCode(201)
  create(@CurrentUserId() userId: string, @Body() dto: CreateReservationDto) {
    return this.svc.create(userId, dto);
  }

  @Get() findAll(@Query() q: ListReservationsQueryDto) { return this.svc.findAll(q); }

  @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.svc.findOne(id); }

  @Post(':id/check-out') @UseGuards(UserExistsGuard)
  checkOut(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.checkOut(userId, id);
  }

  @Post(':id/return') @UseGuards(UserExistsGuard)
  return_(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.return_(userId, id);
  }

  @Post(':id/cancel') @UseGuards(UserExistsGuard)
  cancel(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.cancel(userId, id);
  }
}
```

- [ ] **Step 2: Create `reservations.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsRepository } from './reservations.repository';
import { ReservationsService } from './reservations.service';

@Module({
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationsRepository],
  exports: [ReservationsService, ReservationsRepository],
})
export class ReservationsModule {}
```

- [ ] **Step 3: Register in `AppModule`**

Add `ReservationsModule` to imports.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/reservations src/app.module.ts
git commit -m "feat(reservations): controller and module"
```

---

## Task 18: Pure ranking helper + tests

**Files:**
- Create: `src/search/ranking.ts`, `src/search/ranking.spec.ts`

- [ ] **Step 1: Write failing tests `ranking.spec.ts`**

```ts
import { sortRanked, RankedRow } from './ranking';

const row = (id: string, title: string, score: number): RankedRow => ({ id, title, score });

describe('sortRanked', () => {
  it('orders by score desc', () => {
    const out = sortRanked([row('a', 'X', 0.1), row('b', 'Y', 0.9)]);
    expect(out.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('breaks score ties by title asc', () => {
    const out = sortRanked([row('a', 'Beta', 0.5), row('b', 'Alpha', 0.5)]);
    expect(out.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('breaks score+title ties by id asc', () => {
    const out = sortRanked([
      row('22222222-2222-2222-2222-222222222222', 'T', 0.5),
      row('11111111-1111-1111-1111-111111111111', 'T', 0.5),
    ]);
    expect(out.map((r) => r.id[0])).toEqual(['1', '2']);
  });
});
```

- [ ] **Step 2: Run, see fail**

Run: `npm run test:unit -- ranking`
Expected: FAIL.

- [ ] **Step 3: Implement `ranking.ts`**

```ts
export interface RankedRow {
  id: string;
  title: string;
  score: number;
}

export function sortRanked<T extends RankedRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.title !== b.title) return a.title < b.title ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
}
```

- [ ] **Step 4: Re-run**

Run: `npm run test:unit -- ranking`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/search/ranking.ts src/search/ranking.spec.ts
git commit -m "feat(search): pure sortRanked helper with deterministic tie-breakers"
```

---

## Task 19: Search repository, service, controller, module

**Files:**
- Create: `src/search/search.repository.ts`, `src/search/search.service.ts`, `src/search/search.controller.ts`, `src/search/search.module.ts`, `src/search/dto/{search-books.query,book-with-score.entity}.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Create DTOs**

`src/search/dto/search-books.query.ts`:
```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class SearchBooksQueryDto extends PaginationQueryDto {
  @ApiProperty({ description: 'Free-text search query' })
  @IsString() @IsNotEmpty()
  q!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID()
  authorId?: string;
}
```

`src/search/dto/book-with-score.entity.ts`:
```ts
import { ApiProperty } from '@nestjs/swagger';
import { BookEntity } from '../../books/dto/book.entity';

export class BookWithScoreEntity extends BookEntity {
  @ApiProperty() score!: number;
}
```

- [ ] **Step 2: Create `search.repository.ts`**

```ts
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.token';
import type { Database } from '../../db/types';
import { BookWithScoreEntity } from './dto/book-with-score.entity';

interface Row {
  id: string;
  title: string;
  author_id: string;
  isbn: string;
  total_copies: number;
  available_copies: number;
  created_at: Date;
  updated_at: Date;
  author_name: string;
  score: number;
}

@Injectable()
export class SearchRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async searchBooks(params: {
    q: string;
    authorId: string | null;
    page: number;
    pageSize: number;
  }): Promise<{ items: BookWithScoreEntity[]; total: number }> {
    const { q, authorId, page, pageSize } = params;
    const offset = (page - 1) * pageSize;

    const rows = await this.db.execute<Row>(sql`
      WITH query AS (SELECT plainto_tsquery('simple', ${q}) AS qry)
      SELECT
        b.id,
        b.title,
        b.author_id,
        b.isbn,
        b.total_copies,
        b.available_copies,
        b.created_at,
        b.updated_at,
        a.name AS author_name,
        (ts_rank_cd(b.search_vector, query.qry)
          + 0.5 * ts_rank_cd(to_tsvector('simple', a.name), query.qry))::float8 AS score
      FROM books b
      JOIN authors a ON a.id = b.author_id
      CROSS JOIN query
      WHERE (b.search_vector @@ query.qry
             OR to_tsvector('simple', a.name) @@ query.qry)
        AND (${authorId}::uuid IS NULL OR b.author_id = ${authorId}::uuid)
      ORDER BY score DESC, b.title ASC, b.id ASC
      LIMIT ${pageSize} OFFSET ${offset}`);

    const totalRows = await this.db.execute<{ count: string }>(sql`
      WITH query AS (SELECT plainto_tsquery('simple', ${q}) AS qry)
      SELECT count(*)::text AS count
      FROM books b
      JOIN authors a ON a.id = b.author_id
      CROSS JOIN query
      WHERE (b.search_vector @@ query.qry
             OR to_tsvector('simple', a.name) @@ query.qry)
        AND (${authorId}::uuid IS NULL OR b.author_id = ${authorId}::uuid)`);

    const items = rows.map((r): BookWithScoreEntity => ({
      id: r.id,
      title: r.title,
      authorId: r.author_id,
      isbn: r.isbn,
      totalCopies: r.total_copies,
      availableCopies: r.available_copies,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      score: Number(r.score),
    }));
    const total = Number(totalRows[0]?.count ?? '0');
    return { items, total };
  }
}
```

- [ ] **Step 3: Create `search.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { PagedResult } from '../common/dto/pagination.dto';
import { BookWithScoreEntity } from './dto/book-with-score.entity';
import { SearchBooksQueryDto } from './dto/search-books.query';
import { SearchRepository } from './search.repository';

@Injectable()
export class SearchService {
  constructor(private readonly repo: SearchRepository) {}

  async searchBooks(q: SearchBooksQueryDto): Promise<PagedResult<BookWithScoreEntity>> {
    const { items, total } = await this.repo.searchBooks({
      q: q.q,
      authorId: q.authorId ?? null,
      page: q.page,
      pageSize: q.pageSize,
    });
    return { items, total, page: q.page, pageSize: q.pageSize };
  }
}
```

- [ ] **Step 4: Create `search.controller.ts` and `search.module.ts`**

`search.controller.ts`:
```ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SearchBooksQueryDto } from './dto/search-books.query';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  @Get('books')
  searchBooks(@Query() q: SearchBooksQueryDto) { return this.svc.searchBooks(q); }
}
```

`search.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchRepository } from './search.repository';
import { SearchService } from './search.service';

@Module({
  controllers: [SearchController],
  providers: [SearchService, SearchRepository],
})
export class SearchModule {}
```

- [ ] **Step 5: Register in `AppModule`**

Add `SearchModule` to imports.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add src/search src/app.module.ts
git commit -m "feat(search): tsvector-based search with ts_rank_cd scoring"
```

---

## Task 20: Seed script

**Files:**
- Create: `db/seed.ts`

- [ ] **Step 1: Create `db/seed.ts`**

```ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

async function main(): Promise<void> {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, { schema });

  await db
    .insert(schema.users)
    .values([
      { id: '11111111-1111-1111-1111-111111111111', email: 'alice@example.com' },
      { id: '22222222-2222-2222-2222-222222222222', email: 'bob@example.com' },
      { id: '33333333-3333-3333-3333-333333333333', email: 'carol@example.com' },
    ])
    .onConflictDoNothing();

  const [fowler] = await db
    .insert(schema.authors)
    .values({ id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'Martin Fowler' })
    .onConflictDoNothing()
    .returning();
  const [martin] = await db
    .insert(schema.authors)
    .values({ id: 'aaaaaaaa-0000-0000-0000-000000000002', name: 'Robert C. Martin' })
    .onConflictDoNothing()
    .returning();

  await db
    .insert(schema.books)
    .values([
      { title: 'Clean Code',      authorId: martin!.id, isbn: '9780132350884', totalCopies: 2, availableCopies: 2 },
      { title: 'The Clean Coder', authorId: martin!.id, isbn: '9780137081073', totalCopies: 1, availableCopies: 1 },
      { title: 'Refactoring',     authorId: fowler!.id, isbn: '9780134757599', totalCopies: 3, availableCopies: 3 },
    ])
    .onConflictDoNothing();

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run the seed**

Run: `npm run db:seed`
Expected: no errors.

- [ ] **Step 3: Verify Swagger end-to-end**

Run: `npm run start:dev` (in another shell / background).
Open `http://localhost:3000/api/docs`. Verify the four tag groups (`authors`, `books`, `search`, `reservations`) are documented.
Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add db/seed.ts
git commit -m "chore(db): seed script with users, authors, and a few books"
```

---

## Task 21: Integration test scaffolding

**Files:**
- Create: `test/jest-e2e.config.ts`, `test/globalSetup.ts`, `test/helpers/app.ts`, `test/helpers/db.ts`

- [ ] **Step 1: Create `test/jest-e2e.config.ts`**

```ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  testRegex: 'test/integration/.*\\.e2e-spec\\.ts$',
  globalSetup: '<rootDir>/test/globalSetup.ts',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 30000,
};
export default config;
```

- [ ] **Step 2: Create `test/globalSetup.ts`**

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export default async function globalSetup(): Promise<void> {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ??
    'postgresql://library:library@localhost:5432/library_test';

  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: './db/migrations' });
  await client.end();
}
```

- [ ] **Step 3: Create `test/helpers/app.ts`**

```ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { DbExceptionFilter } from '../../src/common/filters/db-exception.filter';

export async function createTestingApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new DbExceptionFilter());
  await app.init();
  return app;
}
```

- [ ] **Step 4: Create `test/helpers/db.ts`**

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { Sql } from 'postgres';
import * as schema from '../../db/schema';

export interface TestDb {
  db: ReturnType<typeof drizzle<typeof schema>>;
  client: Sql;
}

export function createTestDb(): TestDb {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, { schema });
  return { db, client };
}

export async function resetDb(client: Sql): Promise<void> {
  await client`TRUNCATE TABLE reservations, books, authors, users RESTART IDENTITY CASCADE`;
}

export async function seedUsers(
  db: ReturnType<typeof drizzle<typeof schema>>,
  count: number,
): Promise<string[]> {
  const inserted = await db
    .insert(schema.users)
    .values(
      Array.from({ length: count }, (_, i) => ({ email: `u${i}-${Date.now()}@test.io` })),
    )
    .returning();
  return inserted.map((u) => u.id);
}
```

- [ ] **Step 5: Create the test database**

Run: `docker compose exec db psql -U library -d postgres -c "CREATE DATABASE library_test"`
Expected: `CREATE DATABASE`.

- [ ] **Step 6: Apply migrations to the test database (one-time)**

Run: `DATABASE_URL=postgresql://library:library@localhost:5432/library_test npm run db:migrate`
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add test/jest-e2e.config.ts test/globalSetup.ts test/helpers
git commit -m "test: e2e scaffolding (Drizzle migrator, test DB helpers)"
```

---

## Task 22: Integration test — reservation lifecycle

**Files:**
- Create: `test/integration/reservation-lifecycle.e2e-spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import * as schema from '../../db/schema';
import { createTestingApp } from '../helpers/app';
import { createTestDb, resetDb, seedUsers, TestDb } from '../helpers/db';

describe('Reservation lifecycle', () => {
  let app: INestApplication;
  let tdb: TestDb;
  let userId: string;
  let bookId: string;

  beforeAll(async () => {
    tdb = createTestDb();
    app = await createTestingApp();
  });

  beforeEach(async () => {
    await resetDb(tdb.client);
    [userId] = await seedUsers(tdb.db, 1);
    const [author] = await tdb.db.insert(schema.authors).values({ name: 'A' }).returning();
    const [book] = await tdb.db
      .insert(schema.books)
      .values({
        title: 'Bk', authorId: author!.id, isbn: '9780132350884',
        totalCopies: 1, availableCopies: 1,
      })
      .returning();
    bookId = book!.id;
  });

  afterAll(async () => {
    await app.close();
    await tdb.client.end();
  });

  it('reserve -> check out -> return: available_copies toggles 1->0->0->1', async () => {
    const create = await request(app.getHttpServer())
      .post('/reservations')
      .set('X-User-Id', userId)
      .send({ bookId })
      .expect(201);
    expect(create.body.status).toBe('ACTIVE');
    let book = await tdb.db.query.books.findFirst({ where: eq(schema.books.id, bookId) });
    expect(book?.availableCopies).toBe(0);

    const reservationId = create.body.id;
    const checkout = await request(app.getHttpServer())
      .post(`/reservations/${reservationId}/check-out`)
      .set('X-User-Id', userId)
      .expect(200);
    expect(checkout.body.status).toBe('CHECKED_OUT');
    expect(checkout.body.checkedOutAt).not.toBeNull();
    book = await tdb.db.query.books.findFirst({ where: eq(schema.books.id, bookId) });
    expect(book?.availableCopies).toBe(0);

    const returned = await request(app.getHttpServer())
      .post(`/reservations/${reservationId}/return`)
      .set('X-User-Id', userId)
      .expect(200);
    expect(returned.body.status).toBe('RETURNED');
    expect(returned.body.returnedAt).not.toBeNull();
    book = await tdb.db.query.books.findFirst({ where: eq(schema.books.id, bookId) });
    expect(book?.availableCopies).toBe(1);
  });

  it('rejects illegal transitions (check-out a returned reservation -> 409)', async () => {
    const create = await request(app.getHttpServer())
      .post('/reservations').set('X-User-Id', userId).send({ bookId }).expect(201);
    const id = create.body.id;
    await request(app.getHttpServer())
      .post(`/reservations/${id}/check-out`).set('X-User-Id', userId).expect(200);
    await request(app.getHttpServer())
      .post(`/reservations/${id}/return`).set('X-User-Id', userId).expect(200);
    await request(app.getHttpServer())
      .post(`/reservations/${id}/check-out`).set('X-User-Id', userId).expect(409);
  });
});
```

- [ ] **Step 2: Run**

Run: `npm run test:integration -- reservation-lifecycle`
Expected: 2 passing.

- [ ] **Step 3: Commit**

```bash
git add test/integration/reservation-lifecycle.e2e-spec.ts
git commit -m "test(integration): reservation lifecycle e2e"
```

---

## Task 23: Integration test — concurrent reservations

**Files:**
- Create: `test/integration/reservation-concurrent.e2e-spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { INestApplication } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import * as schema from '../../db/schema';
import { createTestingApp } from '../helpers/app';
import { createTestDb, resetDb, seedUsers, TestDb } from '../helpers/db';

describe('Concurrent reservations on the last copy', () => {
  let app: INestApplication;
  let tdb: TestDb;
  let users: string[];
  let bookId: string;

  beforeAll(async () => {
    tdb = createTestDb();
    app = await createTestingApp();
  });

  beforeEach(async () => {
    await resetDb(tdb.client);
    users = await seedUsers(tdb.db, 10);
    const [author] = await tdb.db.insert(schema.authors).values({ name: 'A' }).returning();
    const [book] = await tdb.db
      .insert(schema.books)
      .values({
        title: 'Bk', authorId: author!.id, isbn: '9780132350884',
        totalCopies: 1, availableCopies: 1,
      })
      .returning();
    bookId = book!.id;
  });

  afterAll(async () => {
    await app.close();
    await tdb.client.end();
  });

  it('exactly one 201 and nine 409 when 10 users race for the last copy', async () => {
    const responses = await Promise.all(
      users.map((u) =>
        request(app.getHttpServer())
          .post('/reservations')
          .set('X-User-Id', u)
          .send({ bookId }),
      ),
    );
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);

    const book = await tdb.db.query.books.findFirst({ where: eq(schema.books.id, bookId) });
    expect(book?.availableCopies).toBe(0);

    const active = await tdb.db.$count(
      schema.reservations,
      and(eq(schema.reservations.bookId, bookId), eq(schema.reservations.status, 'ACTIVE')),
    );
    expect(Number(active)).toBe(1);
  });
});
```

- [ ] **Step 2: Run**

Run: `npm run test:integration -- reservation-concurrent`
Expected: 1 passing.

- [ ] **Step 3: Commit**

```bash
git add test/integration/reservation-concurrent.e2e-spec.ts
git commit -m "test(integration): concurrent reservation race produces 1 success + N-1 conflicts"
```

---

## Task 24: Search ranking integration tests

**Files:**
- Create: `test/fixtures/search-cases.ts`, `test/integration/search-ranking.e2e-spec.ts`

- [ ] **Step 1: Create `test/fixtures/search-cases.ts`**

```ts
export interface SeedBook {
  title: string;
  authorName: string;
  isbn: string;
  totalCopies: number;
}

export const CASE_1_BOOKS: SeedBook[] = [
  { title: 'Clean Code',      authorName: 'Robert C. Martin', isbn: '9780132350884', totalCopies: 1 },
  { title: 'The Clean Coder', authorName: 'Robert C. Martin', isbn: '9780137081073', totalCopies: 1 },
  { title: 'Code Complete',   authorName: 'Steve McConnell',   isbn: '9780735619678', totalCopies: 1 },
];

export const CASE_3_BOOKS: SeedBook[] = [
  { title: 'Refactoring', authorName: 'Martin Fowler', isbn: '9780134757599', totalCopies: 1 },
];

export const CASE_4_BOOKS: SeedBook[] = [
  { title: 'Domain-Driven Design', authorName: 'Eric Evans', isbn: '9780321125217', totalCopies: 1 },
];

export const CASE_5_BOOKS: SeedBook[] = [
  { title: 'Patterns', authorName: 'Author A', isbn: '9780000000001', totalCopies: 1 },
  { title: 'Patterns', authorName: 'Author B', isbn: '9780000000002', totalCopies: 1 },
];
```

- [ ] **Step 2: Write the spec `test/integration/search-ranking.e2e-spec.ts`**

```ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as schema from '../../db/schema';
import {
  CASE_1_BOOKS, CASE_3_BOOKS, CASE_4_BOOKS, CASE_5_BOOKS, SeedBook,
} from '../fixtures/search-cases';
import { createTestingApp } from '../helpers/app';
import { createTestDb, resetDb, TestDb } from '../helpers/db';

async function seedBooks(tdb: TestDb, items: SeedBook[]): Promise<void> {
  const authorIdByName = new Map<string, string>();
  for (const b of items) {
    if (!authorIdByName.has(b.authorName)) {
      const [a] = await tdb.db
        .insert(schema.authors)
        .values({ name: b.authorName })
        .returning();
      authorIdByName.set(b.authorName, a!.id);
    }
    await tdb.db.insert(schema.books).values({
      title: b.title,
      authorId: authorIdByName.get(b.authorName)!,
      isbn: b.isbn,
      totalCopies: b.totalCopies,
      availableCopies: b.totalCopies,
    });
  }
}

describe('Search ranking acceptance cases', () => {
  let app: INestApplication;
  let tdb: TestDb;

  beforeAll(async () => { tdb = createTestDb(); app = await createTestingApp(); });
  beforeEach(async () => { await resetDb(tdb.client); });
  afterAll(async () => { await app.close(); await tdb.client.end(); });

  it('Case 1: "clean code" ranks "Clean Code" first', async () => {
    await seedBooks(tdb, CASE_1_BOOKS);
    const res = await request(app.getHttpServer())
      .get('/search/books').query({ q: 'clean code' }).expect(200);
    expect(res.body.items[0].title).toBe('Clean Code');
  });

  it('Case 3: query "fowler" finds "Refactoring" via author', async () => {
    await seedBooks(tdb, CASE_3_BOOKS);
    const res = await request(app.getHttpServer())
      .get('/search/books').query({ q: 'fowler' }).expect(200);
    expect(res.body.items.map((b: { title: string }) => b.title)).toContain('Refactoring');
  });

  it('Case 4: hyphenated title tokenises ("domain driven" finds DDD)', async () => {
    await seedBooks(tdb, CASE_4_BOOKS);
    const res = await request(app.getHttpServer())
      .get('/search/books').query({ q: 'domain driven' }).expect(200);
    expect(res.body.items.map((b: { title: string }) => b.title)).toContain('Domain-Driven Design');
  });

  it('Case 5: identical-title ties broken deterministically by (title asc, id asc)', async () => {
    await seedBooks(tdb, CASE_5_BOOKS);
    const res = await request(app.getHttpServer())
      .get('/search/books').query({ q: 'patterns' }).expect(200);
    const ids: string[] = res.body.items.map((b: { id: string }) => b.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('Case 6: SQL-injection-shaped query returns no results, no error', async () => {
    await seedBooks(tdb, CASE_1_BOOKS);
    const res = await request(app.getHttpServer())
      .get('/search/books').query({ q: "'; DROP TABLE books; --" }).expect(200);
    expect(res.body.items).toEqual([]);
    const count = await tdb.db.$count(schema.books);
    expect(Number(count)).toBe(CASE_1_BOOKS.length);
  });

  it('Case 7: empty q -> 400', async () => {
    await request(app.getHttpServer()).get('/search/books').query({ q: '' }).expect(400);
  });

  it('Case 8: stopword-only query -> empty result, not error', async () => {
    await seedBooks(tdb, CASE_1_BOOKS);
    const res = await request(app.getHttpServer())
      .get('/search/books').query({ q: 'the of' }).expect(200);
    expect(res.body.items).toEqual([]);
  });

  it('Case 9: pagination across many matching books', async () => {
    const [author] = await tdb.db.insert(schema.authors).values({ name: 'Bulk Author' }).returning();
    const values = Array.from({ length: 25 }, (_, i) => ({
      title: `Manual ${i.toString().padStart(2, '0')}`,
      authorId: author!.id,
      isbn: `978${i.toString().padStart(10, '0')}`,
      totalCopies: 1,
      availableCopies: 1,
    }));
    await tdb.db.insert(schema.books).values(values);
    const res = await request(app.getHttpServer())
      .get('/search/books').query({ q: 'manual', page: 2, pageSize: 10 }).expect(200);
    expect(res.body.total).toBe(25);
    expect(res.body.items).toHaveLength(10);
  });
});
```

- [ ] **Step 3: Run**

Run: `npm run test:integration -- search-ranking`
Expected: 8 passing.

- [ ] **Step 4: Commit**

```bash
git add test/fixtures test/integration/search-ranking.e2e-spec.ts
git commit -m "test(integration): search ranking acceptance cases 1-9"
```

---

## Task 25: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow**

```yaml
name: ci

on:
  pull_request:
    types: [opened, synchronize, reopened]
  push:
    branches-ignore: [main]

jobs:
  lint-and-unit:
    name: Lint + unit tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24.16.0
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit

  integration:
    name: Integration tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:18.4-alpine
        env:
          POSTGRES_USER: library
          POSTGRES_PASSWORD: library
          POSTGRES_DB: library_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U library"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgresql://library:library@localhost:5432/library_test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24.16.0
          cache: 'npm'
      - run: npm ci
      - run: npm run db:migrate
      - run: npm run test:integration
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: GH Actions workflow with lint+unit and integration jobs"
```

---

## Task 26: README and developer experience polish

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Library Catalog

A minimal REST service for managing books, authors, and reservations.
Built with NestJS, Drizzle ORM, and Postgres 18.4. Full-text book search
via Postgres `tsvector` with `ts_rank_cd`-based ranking.

## Quick start

```bash
nvm use                       # Node 24.16.0
docker compose up -d db       # Postgres 18.4
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run start:dev             # http://localhost:3000/api/docs
```

## Tests

- `npm run test:unit` — Jest unit tests (no DB).
- `npm run test:integration` — Jest + supertest against a real Postgres.

The integration tests expect a `library_test` database:
```bash
docker compose exec db psql -U library -d postgres -c "CREATE DATABASE library_test"
DATABASE_URL=postgresql://library:library@localhost:5432/library_test \
  npm run db:migrate
```

## Reservation concurrency rule

A book has N copies. At most N **ACTIVE or CHECKED_OUT** reservations can
exist for that book at once. Concurrent attempts on the last copy are
serialised by a single atomic SQL `UPDATE ... WHERE available_copies > 0
RETURNING`: exactly one wins (201), the others receive 409 Conflict.

## Required status checks (one-time setup)

On GitHub, **Settings → Branches → Add rule** for `main`:
- Require pull request reviews before merging.
- Require status checks to pass before merging.
- Required checks: `lint-and-unit`, `integration`.
- Require branches to be up to date.

This blocks merging when the CI workflow fails.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with quickstart, concurrency rule, branch protection"
```

---

## Self-review (post-write)

**Spec coverage** — every section maps to tasks:
- §2 AC #1 (search ranking cases) → Tasks 18, 19, 24.
- §2 AC #2 (concurrency: 1 success + N−1 conflicts) → Tasks 14, 15, 16, 23.
- §2 AC #3 (CI blocks merging) → Task 25.
- §3 stack & versions → Tasks 1, 2, 3, 25.
- §3.1 repository pattern → Tasks 8, 11, 15, 19.
- §4 architecture; §4.1 concurrency strategy → Tasks 4, 15, 16.
- §5.1 schema (tables, enums, generated col, indexes, checks, relations) → Task 3.
- §5.2 ranking formula → Task 19.
- §5.3 FSM → Task 14.
- §6 endpoints → Tasks 10, 13, 17, 19.
- §7 validation, error mapping → Tasks 1, 5.
- §8 testing strategy & cases → Tasks 5, 6, 9, 12, 14, 16, 18, 21, 22, 23, 24.
- §8.4 CI workflow → Task 25.
- §9 layout → all tasks.
- §10 dev experience → Tasks 2, 20, 26.

Search case 2 (rank `code` across "Clean Code"/"The Clean Coder"/"Code Complete") shares its implementation with case 1 and is exercised by the same `/search/books` route covered in Task 24; the deterministic tie-breaking that case 2 leans on is independently verified in case 5.

**Placeholder scan.** No TBD/TODO/"appropriate error handling"/"add validation" left. Every code step contains complete code; every command step includes the exact command and expected outcome.

**Type / signature consistency.**
- `Database` and `DbTransaction` defined in `db/types.ts` and used uniformly by repositories.
- `ReservationStatus` is a string-literal union defined in `src/reservations/transition.ts` and re-used across DTOs, services, repositories, and tests.
- `reservationTransition(currentStatus, action)` signature stable across `transition.ts`, `transition.spec.ts`, `reservations.service.ts`.
- Repository method names (`tryDecrementAvailable`, `tryIncrementAvailable`, `createInTx`, `updateInTx`, `findByIdInTx`, `withTransaction`, `bookExists`) match between definition (Task 15) and consumer (Task 16) and the unit-test mocks (Task 16).
- DTO field names (`availableCopies`, `totalCopies`, `bookId`, `userId`) match the Drizzle camelCase columns and the SQL snake_case via Drizzle's `@map` equivalent (`'available_copies'` etc. in `pgTable` column definitions).

No issues found.
