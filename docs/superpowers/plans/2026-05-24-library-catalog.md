# Library Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a NestJS + Prisma + Postgres library catalog service with full-text book search and a concurrency-safe reservation flow, exercisable via Swagger UI, with unit and integration tests that block merging in GitHub Actions on failure.

**Architecture:** A single NestJS app with feature modules (Authors, Books, Search, Reservations) backed by Postgres 18.4 via Prisma. Search uses a Postgres `tsvector` generated column + GIN index, ranked with `ts_rank_cd`. Reservations use a single atomic `UPDATE ... WHERE available_copies > 0 RETURNING` inside a Prisma transaction to enforce concurrency without explicit row locks.

**Tech Stack:** Node.js 24.16.0, TypeScript (strict), NestJS, Prisma, Postgres 18.4, Jest, supertest, @nestjs/swagger, class-validator, class-transformer, GitHub Actions.

---

## File Structure

```
/
├── .github/workflows/ci.yml
├── .nvmrc
├── .env.example
├── .gitignore                          (extend existing)
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
├── eslint.config.mjs
├── jest.config.ts                      (unit)
├── prisma/
│   ├── schema.prisma                   (models + reservation_status enum)
│   ├── migrations/
│   │   └── <ts>_init/migration.sql     (initial schema + tsvector generated col + indexes)
│   └── seed.ts
├── src/
│   ├── main.ts                         (bootstrap, Swagger, ValidationPipe)
│   ├── app.module.ts
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── common/
│   │   ├── filters/prisma-exception.filter.ts
│   │   ├── filters/prisma-exception.filter.spec.ts
│   │   ├── guards/user-exists.guard.ts
│   │   ├── guards/user-exists.guard.spec.ts
│   │   ├── decorators/current-user-id.decorator.ts
│   │   └── dto/pagination.dto.ts
│   ├── authors/
│   │   ├── authors.module.ts
│   │   ├── authors.controller.ts
│   │   ├── authors.service.ts
│   │   ├── authors.service.spec.ts
│   │   └── dto/*.ts
│   ├── books/
│   │   ├── books.module.ts
│   │   ├── books.controller.ts
│   │   ├── books.service.ts
│   │   ├── books.service.spec.ts
│   │   └── dto/*.ts
│   ├── search/
│   │   ├── search.module.ts
│   │   ├── search.controller.ts
│   │   ├── search.service.ts
│   │   ├── ranking.ts                  (pure)
│   │   ├── ranking.spec.ts
│   │   └── dto/*.ts
│   └── reservations/
│       ├── reservations.module.ts
│       ├── reservations.controller.ts
│       ├── reservations.service.ts
│       ├── reservations.service.spec.ts
│       ├── transition.ts               (pure FSM)
│       ├── transition.spec.ts
│       └── dto/*.ts
└── test/
    ├── jest-e2e.config.ts
    ├── globalSetup.ts
    ├── helpers/
    │   ├── app.ts                      (createTestingApp)
    │   └── db.ts                       (truncate / seed helpers)
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

- [ ] **Step 1: Pin Node and update .gitignore**

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

- [ ] **Step 2: Create `package.json`**

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
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
    "test:unit": "jest --config jest.config.ts",
    "test:integration": "jest --config test/jest-e2e.config.ts --runInBand",
    "db:migrate": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:seed": "ts-node prisma/seed.ts",
    "prisma:generate": "prisma generate"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.0",
    "@nestjs/config": "^3.2.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/platform-express": "^10.4.0",
    "@nestjs/swagger": "^7.4.0",
    "@prisma/client": "^5.20.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.0",
    "@nestjs/testing": "^10.4.0",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/node": "^22.5.0",
    "@types/supertest": "^6.0.2",
    "@typescript-eslint/eslint-plugin": "^8.5.0",
    "@typescript-eslint/parser": "^8.5.0",
    "eslint": "^9.10.0",
    "jest": "^29.7.0",
    "prisma": "^5.20.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json` and `tsconfig.build.json`**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "moduleResolution": "node",
    "declaration": false,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "test/**/*", "prisma/seed.ts"]
}
```

`tsconfig.build.json`:
```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts", "prisma/seed.ts"]
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
    files: ['src/**/*.ts', 'test/**/*.ts'],
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

async function bootstrap() {
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
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **Step 6: Install dependencies and verify build**

Run: `npm install`
Run: `npm run build`
Expected: build succeeds, `dist/main.js` exists.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: scaffold NestJS project with Node 24.16 and Swagger bootstrap"
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
DATABASE_URL=postgresql://library:library@localhost:5432/library?schema=public
PORT=3000
```

`.env` (not committed):
```
DATABASE_URL=postgresql://library:library@localhost:5432/library?schema=public
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

## Task 3: Prisma schema, initial migration with tsvector column

**Files:**
- Create: `prisma/schema.prisma`, `prisma/migrations/<ts>_init/migration.sql`

- [ ] **Step 1: Initialize Prisma**

Run: `npx prisma init --datasource-provider postgresql`

Then replace the generated `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ReservationStatus {
  ACTIVE
  CHECKED_OUT
  RETURNED
  CANCELLED
}

model Author {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  books     Book[]

  @@map("authors")
}

model Book {
  id              String   @id @default(uuid()) @db.Uuid
  title           String
  authorId        String   @map("author_id") @db.Uuid
  isbn            String   @unique
  totalCopies     Int      @map("total_copies")
  availableCopies Int      @map("available_copies")
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  author       Author        @relation(fields: [authorId], references: [id])
  reservations Reservation[]

  @@index([authorId])
  @@map("books")
}

model User {
  id           String        @id @default(uuid()) @db.Uuid
  email        String        @unique
  createdAt    DateTime      @default(now()) @map("created_at") @db.Timestamptz(6)
  reservations Reservation[]

  @@map("users")
}

model Reservation {
  id            String            @id @default(uuid()) @db.Uuid
  bookId        String            @map("book_id") @db.Uuid
  userId        String            @map("user_id") @db.Uuid
  status        ReservationStatus
  reservedAt    DateTime          @default(now()) @map("reserved_at") @db.Timestamptz(6)
  checkedOutAt  DateTime?         @map("checked_out_at") @db.Timestamptz(6)
  returnedAt    DateTime?         @map("returned_at") @db.Timestamptz(6)
  cancelledAt   DateTime?         @map("cancelled_at") @db.Timestamptz(6)

  book Book @relation(fields: [bookId], references: [id])
  user User @relation(fields: [userId], references: [id])

  @@index([bookId, status])
  @@index([userId])
  @@map("reservations")
}
```

- [ ] **Step 2: Generate the initial migration**

Run: `npx prisma migrate dev --name init --create-only`
Expected: a file `prisma/migrations/<timestamp>_init/migration.sql` is created. Do NOT apply yet.

- [ ] **Step 3: Append the tsvector generated column, GIN index, and CHECK constraints to the migration**

Append the following SQL to the end of the generated `migration.sql` file:

```sql
-- Title-only search vector (author handled at query time)
ALTER TABLE books
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (setweight(to_tsvector('simple', title), 'A')) STORED;

CREATE INDEX books_search_idx ON books USING GIN (search_vector);

-- Copy invariants
ALTER TABLE books
  ADD CONSTRAINT books_total_copies_nonneg CHECK (total_copies >= 0),
  ADD CONSTRAINT books_available_copies_bounds CHECK (
    available_copies >= 0 AND available_copies <= total_copies
  );
```

- [ ] **Step 4: Apply the migration and generate the Prisma client**

Run: `npx prisma migrate dev`
Run: `npx prisma generate`
Expected: migration applied, `@prisma/client` regenerated, no errors.

- [ ] **Step 5: Verify the schema in Postgres**

Run: `docker compose exec db psql -U library -d library -c "\d books"`
Expected: `search_vector` column visible with `tsvector` type and "stored generated" marker; `books_search_idx` listed.

- [ ] **Step 6: Commit**

```bash
git add prisma/
git commit -m "feat(db): initial Prisma schema with tsvector search column and constraints"
```

---

## Task 4: PrismaService and PrismaModule

**Files:**
- Create: `src/prisma/prisma.service.ts`, `src/prisma/prisma.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Create `src/prisma/prisma.service.ts`**

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

- [ ] **Step 2: Create `src/prisma/prisma.module.ts`**

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 3: Register `PrismaModule` in `AppModule`**

Modify `src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
})
export class AppModule {}
```

- [ ] **Step 4: Build to verify**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/prisma src/app.module.ts
git commit -m "feat: add PrismaService and global PrismaModule"
```

---

## Task 5: PrismaExceptionFilter (with unit tests)

**Files:**
- Create: `src/common/filters/prisma-exception.filter.ts`, `src/common/filters/prisma-exception.filter.spec.ts`, `jest.config.ts`

- [ ] **Step 1: Create `jest.config.ts` for unit tests**

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

- [ ] **Step 2: Write the failing test `prisma-exception.filter.spec.ts`**

```ts
import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

function mockHost(): { host: ArgumentsHost; res: { status: jest.Mock; json: jest.Mock } } {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ url: '/x' }) }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

describe('PrismaExceptionFilter', () => {
  const filter = new PrismaExceptionFilter();

  it('maps P2002 (unique violation) to 409', () => {
    const { host, res } = mockHost();
    const err = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: 'x',
      meta: { target: ['isbn'] },
    });
    filter.catch(err, host);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, error: 'Conflict' }),
    );
  });

  it('maps P2025 (not found) to 404', () => {
    const { host, res } = mockHost();
    const err = new Prisma.PrismaClientKnownRequestError('missing', {
      code: 'P2025',
      clientVersion: 'x',
    });
    filter.catch(err, host);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('maps unknown Prisma errors to 500', () => {
    const { host, res } = mockHost();
    const err = new Prisma.PrismaClientKnownRequestError('boom', {
      code: 'P9999',
      clientVersion: 'x',
    });
    filter.catch(err, host);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
```

- [ ] **Step 3: Run the test, see it fail**

Run: `npm run test:unit -- prisma-exception.filter`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `prisma-exception.filter.ts`**

```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    const mapping: Record<string, { status: HttpStatus; error: string; message: string }> = {
      P2002: { status: HttpStatus.CONFLICT, error: 'Conflict', message: 'Unique constraint violation' },
      P2025: { status: HttpStatus.NOT_FOUND, error: 'Not Found', message: 'Record not found' },
    };
    const m = mapping[exception.code] ?? {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Database error',
    };
    if (m.status >= 500) this.logger.error(exception);
    res.status(m.status).json({ statusCode: m.status, error: m.error, message: m.message });
  }
}
```

- [ ] **Step 5: Re-run the test**

Run: `npm run test:unit -- prisma-exception.filter`
Expected: 3 passing.

- [ ] **Step 6: Register the filter globally in `main.ts`**

In `src/main.ts`, add after the `ValidationPipe`:
```ts
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
// ...
app.useGlobalFilters(new PrismaExceptionFilter());
```

- [ ] **Step 7: Commit**

```bash
git add src/common/filters jest.config.ts src/main.ts
git commit -m "feat(common): add PrismaExceptionFilter mapping P2002/P2025"
```

---

## Task 6: UserExistsGuard and @CurrentUserId() decorator (with tests)

**Files:**
- Create: `src/common/guards/user-exists.guard.ts`, `src/common/guards/user-exists.guard.spec.ts`, `src/common/decorators/current-user-id.decorator.ts`

- [ ] **Step 1: Write the failing test `user-exists.guard.spec.ts`**

```ts
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { UserExistsGuard } from './user-exists.guard';

function ctx(headers: Record<string, string | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('UserExistsGuard', () => {
  const findUnique = jest.fn();
  const prisma = { user: { findUnique } } as any;
  const guard = new UserExistsGuard(prisma);

  beforeEach(() => findUnique.mockReset());

  it('throws 401 when header is missing', async () => {
    await expect(guard.canActivate(ctx({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws 401 when header is not a UUID', async () => {
    await expect(guard.canActivate(ctx({ 'x-user-id': 'not-a-uuid' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws 401 when user is not in DB', async () => {
    findUnique.mockResolvedValue(null);
    await expect(
      guard.canActivate(ctx({ 'x-user-id': '11111111-1111-1111-1111-111111111111' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns true and attaches userId when user exists', async () => {
    findUnique.mockResolvedValue({ id: '11111111-1111-1111-1111-111111111111' });
    const c = ctx({ 'x-user-id': '11111111-1111-1111-1111-111111111111' });
    await expect(guard.canActivate(c)).resolves.toBe(true);
    expect((c.switchToHttp().getRequest() as any).userId).toBe(
      '11111111-1111-1111-1111-111111111111',
    );
  });
});
```

- [ ] **Step 2: Run, see fail**

Run: `npm run test:unit -- user-exists.guard`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `user-exists.guard.ts`**

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class UserExistsGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      userId?: string;
    }>();
    const headerVal = req.headers['x-user-id'];
    if (!headerVal || !UUID_RE.test(headerVal)) {
      throw new UnauthorizedException('Missing or invalid X-User-Id header');
    }
    const user = await this.prisma.user.findUnique({ where: { id: headerVal } });
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
git commit -m "feat(common): add UserExistsGuard and @CurrentUserId() decorator"
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
git commit -m "feat(common): add shared pagination DTO and PagedResult type"
```

---

## Task 8: Authors module — service with unit tests

**Files:**
- Create: `src/authors/authors.service.ts`, `src/authors/authors.service.spec.ts`, `src/authors/dto/create-author.dto.ts`, `src/authors/dto/update-author.dto.ts`, `src/authors/dto/author.entity.ts`

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
import { IsOptional, IsString, MaxLength, IsNotEmpty } from 'class-validator';

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

- [ ] **Step 2: Write failing service tests `authors.service.spec.ts`**

```ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuthorsService } from './authors.service';

function makePrisma() {
  return {
    author: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    book: { count: jest.fn() },
  };
}

describe('AuthorsService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let svc: AuthorsService;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new AuthorsService(prisma as any);
  });

  it('creates an author', async () => {
    prisma.author.create.mockResolvedValue({ id: 'a1', name: 'X', createdAt: new Date() });
    const out = await svc.create({ name: 'X' });
    expect(out.name).toBe('X');
    expect(prisma.author.create).toHaveBeenCalledWith({ data: { name: 'X' } });
  });

  it('returns 404 when getting an unknown author', async () => {
    prisma.author.findUnique.mockResolvedValue(null);
    await expect(svc.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists authors with pagination', async () => {
    prisma.author.findMany.mockResolvedValue([{ id: '1', name: 'A', createdAt: new Date() }]);
    prisma.author.count.mockResolvedValue(1);
    const out = await svc.findAll({ page: 1, pageSize: 20 });
    expect(out.total).toBe(1);
    expect(out.items).toHaveLength(1);
  });

  it('refuses to delete an author with books', async () => {
    prisma.book.count.mockResolvedValue(2);
    await expect(svc.remove('a1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.author.delete).not.toHaveBeenCalled();
  });

  it('deletes an author with no books', async () => {
    prisma.book.count.mockResolvedValue(0);
    prisma.author.delete.mockResolvedValue({});
    await expect(svc.remove('a1')).resolves.toBeUndefined();
    expect(prisma.author.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
  });
});
```

- [ ] **Step 3: Run, see fail**

Run: `npm run test:unit -- authors.service`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `authors.service.ts`**

```ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PagedResult, PaginationQueryDto } from '../common/dto/pagination.dto';
import { AuthorEntity } from './dto/author.entity';
import { CreateAuthorDto } from './dto/create-author.dto';
import { UpdateAuthorDto } from './dto/update-author.dto';

@Injectable()
export class AuthorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAuthorDto): Promise<AuthorEntity> {
    return this.prisma.author.create({ data: { name: dto.name } });
  }

  async findOne(id: string): Promise<AuthorEntity> {
    const a = await this.prisma.author.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Author not found');
    return a;
  }

  async findAll(q: PaginationQueryDto): Promise<PagedResult<AuthorEntity>> {
    const [items, total] = await Promise.all([
      this.prisma.author.findMany({
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.author.count(),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async update(id: string, dto: UpdateAuthorDto): Promise<AuthorEntity> {
    await this.findOne(id);
    return this.prisma.author.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    const bookCount = await this.prisma.book.count({ where: { authorId: id } });
    if (bookCount > 0) throw new ConflictException('Author has books');
    await this.prisma.author.delete({ where: { id } });
  }
}
```

- [ ] **Step 5: Re-run tests**

Run: `npm run test:unit -- authors.service`
Expected: 5 passing.

- [ ] **Step 6: Commit**

```bash
git add src/authors
git commit -m "feat(authors): add AuthorsService with CRUD and book-link guard"
```

---

## Task 9: Authors controller and module

**Files:**
- Create: `src/authors/authors.controller.ts`, `src/authors/authors.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Create `authors.controller.ts`**

```ts
import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe,
  Patch, Post, Query,
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

  @Post()
  create(@Body() dto: CreateAuthorDto) { return this.svc.create(dto); }

  @Get()
  findAll(@Query() q: PaginationQueryDto) { return this.svc.findAll(q); }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.svc.findOne(id); }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAuthorDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(id); }
}
```

- [ ] **Step 2: Create `authors.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { AuthorsController } from './authors.controller';
import { AuthorsService } from './authors.service';

@Module({
  controllers: [AuthorsController],
  providers: [AuthorsService],
  exports: [AuthorsService],
})
export class AuthorsModule {}
```

- [ ] **Step 3: Register in `AppModule`**

Update `src/app.module.ts` imports to include `AuthorsModule`.

- [ ] **Step 4: Build to verify**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/authors src/app.module.ts
git commit -m "feat(authors): add controller, module, and Swagger tags"
```

---

## Task 10: Books service with unit tests

**Files:**
- Create: `src/books/books.service.ts`, `src/books/books.service.spec.ts`, `src/books/dto/{create-book.dto,update-book.dto,book.entity}.ts`

- [ ] **Step 1: Create DTOs**

`src/books/dto/create-book.dto.ts`:
```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsISBN, IsNotEmpty, IsString, IsUUID, Min } from 'class-validator';

export class CreateBookDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  authorId!: string;

  @ApiProperty({ description: 'ISBN-10 or ISBN-13' })
  @IsISBN()
  isbn!: string;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  totalCopies!: number;
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

- [ ] **Step 2: Write failing service tests `books.service.spec.ts`**

```ts
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BooksService } from './books.service';

function makePrisma() {
  return {
    book: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    reservation: { count: jest.fn() },
    author: { findUnique: jest.fn() },
  };
}

describe('BooksService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let svc: BooksService;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new BooksService(prisma as any);
  });

  it('creates a book with availableCopies = totalCopies', async () => {
    prisma.author.findUnique.mockResolvedValue({ id: 'a1' });
    prisma.book.create.mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'b1' }));
    const out = await svc.create({ title: 'T', authorId: 'a1', isbn: '9780132350884', totalCopies: 3 });
    expect(out.availableCopies).toBe(3);
    expect(prisma.book.create).toHaveBeenCalledWith({
      data: { title: 'T', authorId: 'a1', isbn: '9780132350884', totalCopies: 3, availableCopies: 3 },
    });
  });

  it('rejects create when author does not exist', async () => {
    prisma.author.findUnique.mockResolvedValue(null);
    await expect(
      svc.create({ title: 'T', authorId: 'a1', isbn: '9780132350884', totalCopies: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 on unknown id', async () => {
    prisma.book.findUnique.mockResolvedValue(null);
    await expect(svc.findOne('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects totalCopies update that would drive availableCopies negative', async () => {
    prisma.book.findUnique.mockResolvedValue({
      id: 'b1', totalCopies: 5, availableCopies: 1,
    });
    // 5 - 1 = 4 copies are in use; new totalCopies=3 would leave -1 available
    await expect(svc.update('b1', { totalCopies: 3 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies delta to availableCopies when increasing totalCopies', async () => {
    prisma.book.findUnique.mockResolvedValue({
      id: 'b1', totalCopies: 5, availableCopies: 2,
    });
    prisma.book.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'b1', totalCopies: 5, availableCopies: 2, ...data }),
    );
    const out = await svc.update('b1', { totalCopies: 7 });
    expect(out.totalCopies).toBe(7);
    expect(out.availableCopies).toBe(4); // 2 + (7-5)
  });

  it('refuses to delete a book with non-terminal reservations', async () => {
    prisma.reservation.count.mockResolvedValue(1);
    await expect(svc.remove('b1')).rejects.toBeInstanceOf(ConflictException);
  });
});
```

- [ ] **Step 3: Run, see fail**

Run: `npm run test:unit -- books.service`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `books.service.ts`**

```ts
import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PagedResult, PaginationQueryDto } from '../common/dto/pagination.dto';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BookEntity } from './dto/book.entity';

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBookDto): Promise<BookEntity> {
    const author = await this.prisma.author.findUnique({ where: { id: dto.authorId } });
    if (!author) throw new NotFoundException('Author not found');
    return this.prisma.book.create({
      data: {
        title: dto.title,
        authorId: dto.authorId,
        isbn: dto.isbn,
        totalCopies: dto.totalCopies,
        availableCopies: dto.totalCopies,
      },
    });
  }

  async findOne(id: string): Promise<BookEntity> {
    const b = await this.prisma.book.findUnique({ where: { id }, include: { author: true } });
    if (!b) throw new NotFoundException('Book not found');
    return b;
  }

  async findAll(
    q: PaginationQueryDto & { authorId?: string },
  ): Promise<PagedResult<BookEntity>> {
    const where = q.authorId ? { authorId: q.authorId } : {};
    const [items, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { author: true },
      }),
      this.prisma.book.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async update(id: string, dto: UpdateBookDto): Promise<BookEntity> {
    const current = await this.prisma.book.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Book not found');

    const data: Record<string, unknown> = { ...dto };
    if (dto.totalCopies !== undefined) {
      const delta = dto.totalCopies - current.totalCopies;
      const newAvailable = current.availableCopies + delta;
      if (newAvailable < 0) {
        throw new BadRequestException(
          'totalCopies cannot be reduced below the number of copies currently in use',
        );
      }
      data.availableCopies = newAvailable;
    }
    return this.prisma.book.update({
      where: { id },
      data,
      include: { author: true },
    });
  }

  async remove(id: string): Promise<void> {
    const active = await this.prisma.reservation.count({
      where: { bookId: id, status: { in: ['ACTIVE', 'CHECKED_OUT'] } },
    });
    if (active > 0) throw new ConflictException('Book has active reservations');
    await this.prisma.book.delete({ where: { id } });
  }
}
```

- [ ] **Step 5: Re-run tests**

Run: `npm run test:unit -- books.service`
Expected: 6 passing.

- [ ] **Step 6: Commit**

```bash
git add src/books
git commit -m "feat(books): add BooksService with copy-count invariants"
```

---

## Task 11: Books controller and module

**Files:**
- Create: `src/books/books.controller.ts`, `src/books/books.module.ts`, `src/books/dto/list-books.query.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Create list query DTO**

`src/books/dto/list-books.query.ts`:
```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ListBooksQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  authorId?: string;
}
```

- [ ] **Step 2: Create `books.controller.ts`**

```ts
import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe,
  Patch, Post, Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { ListBooksQueryDto } from './dto/list-books.query';

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

- [ ] **Step 3: Create `books.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

@Module({
  controllers: [BooksController],
  providers: [BooksService],
  exports: [BooksService],
})
export class BooksModule {}
```

- [ ] **Step 4: Register in `AppModule`**

Add `BooksModule` to `imports` in `src/app.module.ts`.

- [ ] **Step 5: Build to verify**

Run: `npm run build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/books src/app.module.ts
git commit -m "feat(books): add controller and module"
```

---

## Task 12: Reservation FSM (pure function with exhaustive tests)

**Files:**
- Create: `src/reservations/transition.ts`, `src/reservations/transition.spec.ts`

- [ ] **Step 1: Write failing tests `transition.spec.ts`**

```ts
import { reservationTransition, ReservationAction } from './transition';
import { ReservationStatus } from '@prisma/client';

const ALL_STATUSES: ReservationStatus[] = ['ACTIVE', 'CHECKED_OUT', 'RETURNED', 'CANCELLED'];
const ALL_ACTIONS: ReservationAction[] = ['check_out', 'return', 'cancel'];

const legal: Array<[ReservationStatus, ReservationAction, ReservationStatus]> = [
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
import { ReservationStatus } from '@prisma/client';

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

- [ ] **Step 4: Re-run tests**

Run: `npm run test:unit -- transition`
Expected: 4 passing (3 legal cases + 1 illegal-matrix test).

- [ ] **Step 5: Commit**

```bash
git add src/reservations/transition.ts src/reservations/transition.spec.ts
git commit -m "feat(reservations): add pure FSM with exhaustive transition tests"
```

---

## Task 13: ReservationsService — atomic UPDATE with unit tests

**Files:**
- Create: `src/reservations/reservations.service.ts`, `src/reservations/reservations.service.spec.ts`, `src/reservations/dto/{create-reservation.dto,reservation.entity,list-reservations.query}.ts`

- [ ] **Step 1: Create DTOs**

`src/reservations/dto/create-reservation.dto.ts`:
```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  bookId!: string;
}
```

`src/reservations/dto/reservation.entity.ts`:
```ts
import { ApiProperty } from '@nestjs/swagger';
import { ReservationStatus } from '@prisma/client';

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
import { ReservationStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ListReservationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() userId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() bookId?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'CHECKED_OUT', 'RETURNED', 'CANCELLED'] })
  @IsOptional() @IsEnum(['ACTIVE', 'CHECKED_OUT', 'RETURNED', 'CANCELLED'] as const)
  status?: ReservationStatus;
}
```

- [ ] **Step 2: Write failing tests `reservations.service.spec.ts`**

```ts
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReservationsService } from './reservations.service';

function makePrisma() {
  const queryRaw = jest.fn();
  const reservation = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  };
  const book = { findUnique: jest.fn() };
  const tx = { reservation, book, $queryRaw: queryRaw };
  const $transaction = jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx));
  return { $transaction, $queryRaw: queryRaw, reservation, book, tx };
}

describe('ReservationsService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let svc: ReservationsService;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new ReservationsService(prisma as any);
  });

  describe('create()', () => {
    it('throws 404 when book does not exist', async () => {
      prisma.tx.book.findUnique.mockResolvedValue(null);
      await expect(svc.create('u1', { bookId: 'b1' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 409 when atomic UPDATE returns no rows', async () => {
      prisma.tx.book.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.tx.$queryRaw.mockResolvedValue([]); // no copies
      await expect(svc.create('u1', { bookId: 'b1' })).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.tx.reservation.create).not.toHaveBeenCalled();
    });

    it('creates ACTIVE reservation when atomic UPDATE returns a row', async () => {
      prisma.tx.book.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.tx.$queryRaw.mockResolvedValue([{ id: 'b1' }]);
      prisma.tx.reservation.create.mockResolvedValue({
        id: 'r1', bookId: 'b1', userId: 'u1', status: 'ACTIVE',
        reservedAt: new Date(), checkedOutAt: null, returnedAt: null, cancelledAt: null,
      });
      const out = await svc.create('u1', { bookId: 'b1' });
      expect(out.status).toBe('ACTIVE');
    });
  });

  describe('checkOut()', () => {
    it('forbids non-owners', async () => {
      prisma.reservation.findUnique.mockResolvedValue({ id: 'r1', userId: 'someone', status: 'ACTIVE' });
      await expect(svc.checkOut('u1', 'r1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects illegal transition', async () => {
      prisma.tx.reservation.findUnique.mockResolvedValue({ id: 'r1', userId: 'u1', status: 'RETURNED' });
      await expect(svc.checkOut('u1', 'r1')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('return()', () => {
    it('increments availableCopies via atomic UPDATE then marks reservation RETURNED', async () => {
      prisma.tx.reservation.findUnique.mockResolvedValue({ id: 'r1', userId: 'u1', bookId: 'b1', status: 'CHECKED_OUT' });
      prisma.tx.$queryRaw.mockResolvedValue([{ id: 'b1' }]);
      prisma.tx.reservation.update.mockResolvedValue({
        id: 'r1', bookId: 'b1', userId: 'u1', status: 'RETURNED',
        reservedAt: new Date(), checkedOutAt: new Date(), returnedAt: new Date(), cancelledAt: null,
      });
      const out = await svc.return_('u1', 'r1');
      expect(out.status).toBe('RETURNED');
      expect(prisma.tx.$queryRaw).toHaveBeenCalled();
    });
  });
});
```

> Note: `findUnique` is consulted **inside** the transaction; the test uses `prisma.tx.reservation.findUnique` consistently. Where the failing-path test uses `prisma.reservation.findUnique` (the non-tx one), that is intentional — `checkOut()` performs the ownership check before opening the transaction.

- [ ] **Step 3: Run, see fail**

Run: `npm run test:unit -- reservations.service`
Expected: FAIL.

- [ ] **Step 4: Implement `reservations.service.ts`**

```ts
import {
  ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PagedResult } from '../common/dto/pagination.dto';
import { reservationTransition } from './transition';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationEntity } from './dto/reservation.entity';
import { ListReservationsQueryDto } from './dto/list-reservations.query';

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateReservationDto): Promise<ReservationEntity> {
    return this.prisma.$transaction(async (tx) => {
      const book = await tx.book.findUnique({ where: { id: dto.bookId } });
      if (!book) throw new NotFoundException('Book not found');

      const rows = await tx.$queryRaw<{ id: string }[]>`
        UPDATE books
           SET available_copies = available_copies - 1
         WHERE id = ${dto.bookId}::uuid
           AND available_copies > 0
        RETURNING id`;
      if (rows.length === 0) throw new ConflictException('No copies available');

      return tx.reservation.create({
        data: { bookId: dto.bookId, userId, status: 'ACTIVE' },
      });
    });
  }

  async findOne(id: string): Promise<ReservationEntity> {
    const r = await this.prisma.reservation.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Reservation not found');
    return r;
  }

  async findAll(q: ListReservationsQueryDto): Promise<PagedResult<ReservationEntity>> {
    const where: Prisma.ReservationWhereInput = {
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.bookId ? { bookId: q.bookId } : {}),
      ...(q.status ? { status: q.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        orderBy: { reservedAt: 'desc' },
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async checkOut(userId: string, id: string): Promise<ReservationEntity> {
    const owner = await this.prisma.reservation.findUnique({ where: { id } });
    if (!owner) throw new NotFoundException('Reservation not found');
    if (owner.userId !== userId) throw new ForbiddenException('Not the reservation owner');

    return this.prisma.$transaction(async (tx) => {
      const r = await tx.reservation.findUnique({ where: { id } });
      if (!r) throw new NotFoundException('Reservation not found');
      const next = reservationTransition(r.status, 'check_out');
      return tx.reservation.update({
        where: { id },
        data: { status: next, checkedOutAt: new Date() },
      });
    });
  }

  async return_(userId: string, id: string): Promise<ReservationEntity> {
    return this.transitionWithCopyChange(userId, id, 'return', +1, 'returnedAt');
  }

  async cancel(userId: string, id: string): Promise<ReservationEntity> {
    return this.transitionWithCopyChange(userId, id, 'cancel', +1, 'cancelledAt');
  }

  private async transitionWithCopyChange(
    userId: string,
    id: string,
    action: 'return' | 'cancel',
    delta: number,
    timestampField: 'returnedAt' | 'cancelledAt',
  ): Promise<ReservationEntity> {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.reservation.findUnique({ where: { id } });
      if (!r) throw new NotFoundException('Reservation not found');
      if (r.userId !== userId) throw new ForbiddenException('Not the reservation owner');
      const next: ReservationStatus = reservationTransition(r.status, action);

      const rows = await tx.$queryRaw<{ id: string }[]>`
        UPDATE books
           SET available_copies = available_copies + ${delta}
         WHERE id = ${r.bookId}::uuid
           AND available_copies + ${delta} <= total_copies
        RETURNING id`;
      if (rows.length === 0) {
        throw new ConflictException('Copy accounting invariant violated');
      }

      return tx.reservation.update({
        where: { id },
        data: { status: next, [timestampField]: new Date() },
      });
    });
  }
}
```

- [ ] **Step 5: Re-run tests**

Run: `npm run test:unit -- reservations.service`
Expected: passing.

- [ ] **Step 6: Commit**

```bash
git add src/reservations
git commit -m "feat(reservations): ReservationsService with atomic UPDATE concurrency"
```

---

## Task 14: Reservations controller and module

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

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.svc.findOne(id); }

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
import { ReservationsService } from './reservations.service';

@Module({
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
```

- [ ] **Step 3: Register in `AppModule`**

Add `ReservationsModule` to `imports`.

- [ ] **Step 4: Build to verify**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/reservations src/app.module.ts
git commit -m "feat(reservations): add controller and module"
```

---

## Task 15: Search ranking (pure function with unit tests)

**Files:**
- Create: `src/search/ranking.ts`, `src/search/ranking.spec.ts`

This pure function is what unit-tests the *ordering* logic independently of Postgres. The integration tests in Task 19 verify the actual Postgres-side ranking.

- [ ] **Step 1: Write failing tests `ranking.spec.ts`**

```ts
import { sortRanked, RankedRow } from './ranking';

const row = (id: string, title: string, score: number): RankedRow => ({ id, title, score });

describe('sortRanked', () => {
  it('orders by score desc', () => {
    const out = sortRanked([row('a', 'X', 0.1), row('b', 'Y', 0.9)]);
    expect(out.map(r => r.id)).toEqual(['b', 'a']);
  });

  it('breaks score ties by title asc', () => {
    const out = sortRanked([row('a', 'Beta', 0.5), row('b', 'Alpha', 0.5)]);
    expect(out.map(r => r.id)).toEqual(['b', 'a']);
  });

  it('breaks score+title ties by id asc', () => {
    const out = sortRanked([
      row('22222222-2222-2222-2222-222222222222', 'T', 0.5),
      row('11111111-1111-1111-1111-111111111111', 'T', 0.5),
    ]);
    expect(out.map(r => r.id[0])).toEqual(['1', '2']);
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

- [ ] **Step 4: Re-run tests**

Run: `npm run test:unit -- ranking`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/search/ranking.ts src/search/ranking.spec.ts
git commit -m "feat(search): pure sortRanked helper with deterministic tie-breakers"
```

---

## Task 16: SearchService, controller, and module

**Files:**
- Create: `src/search/search.service.ts`, `src/search/search.controller.ts`, `src/search/search.module.ts`, `src/search/dto/{search-books.query,book-with-score.entity}.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Create DTOs**

`src/search/dto/search-books.query.ts`:
```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class SearchBooksQueryDto extends PaginationQueryDto {
  @ApiProperty({ description: 'Free-text search query' })
  @IsString()
  @IsNotEmpty()
  q!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
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

- [ ] **Step 2: Implement `search.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PagedResult } from '../common/dto/pagination.dto';
import { SearchBooksQueryDto } from './dto/search-books.query';
import { BookWithScoreEntity } from './dto/book-with-score.entity';

type Row = {
  id: string;
  title: string;
  author_id: string;
  isbn: string;
  total_copies: number;
  available_copies: number;
  created_at: Date;
  updated_at: Date;
  score: number;
  author_name: string;
};

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchBooks(q: SearchBooksQueryDto): Promise<PagedResult<BookWithScoreEntity>> {
    const offset = (q.page - 1) * q.pageSize;

    const filterAuthor = q.authorId ?? null;

    const rows = await this.prisma.$queryRaw<Row[]>`
      WITH query AS (SELECT plainto_tsquery('simple', ${q.q}) AS qry)
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
          + 0.5 * ts_rank_cd(to_tsvector('simple', a.name), query.qry)) AS score
      FROM books b
      JOIN authors a ON a.id = b.author_id
      CROSS JOIN query
      WHERE (b.search_vector @@ query.qry
             OR to_tsvector('simple', a.name) @@ query.qry)
        AND (${filterAuthor}::uuid IS NULL OR b.author_id = ${filterAuthor}::uuid)
      ORDER BY score DESC, b.title ASC, b.id ASC
      LIMIT ${q.pageSize} OFFSET ${offset}`;

    const totalRows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      WITH query AS (SELECT plainto_tsquery('simple', ${q.q}) AS qry)
      SELECT count(*)::bigint AS count
      FROM books b
      JOIN authors a ON a.id = b.author_id
      CROSS JOIN query
      WHERE (b.search_vector @@ query.qry
             OR to_tsvector('simple', a.name) @@ query.qry)
        AND (${filterAuthor}::uuid IS NULL OR b.author_id = ${filterAuthor}::uuid)`;

    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        authorId: r.author_id,
        isbn: r.isbn,
        totalCopies: r.total_copies,
        availableCopies: r.available_copies,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        score: Number(r.score),
      })),
      total: Number(totalRows[0]?.count ?? 0n),
      page: q.page,
      pageSize: q.pageSize,
    };
  }
}
```

- [ ] **Step 3: Implement `search.controller.ts`**

```ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchBooksQueryDto } from './dto/search-books.query';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  @Get('books')
  searchBooks(@Query() q: SearchBooksQueryDto) {
    return this.svc.searchBooks(q);
  }
}
```

- [ ] **Step 4: Implement `search.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
```

- [ ] **Step 5: Register in `AppModule`**

Add `SearchModule` to `imports`.

- [ ] **Step 6: Build to verify**

Run: `npm run build`
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add src/search src/app.module.ts
git commit -m "feat(search): tsvector-based full-text search with ts_rank_cd scoring"
```

---

## Task 17: Seed script

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 1: Create `prisma/seed.ts`**

```ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Users
  await prisma.user.createMany({
    data: [
      { id: '11111111-1111-1111-1111-111111111111', email: 'alice@example.com' },
      { id: '22222222-2222-2222-2222-222222222222', email: 'bob@example.com' },
      { id: '33333333-3333-3333-3333-333333333333', email: 'carol@example.com' },
    ],
    skipDuplicates: true,
  });

  // Authors
  const fowler = await prisma.author.upsert({
    where: { id: 'aaaaaaaa-0000-0000-0000-000000000001' },
    update: {},
    create: { id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'Martin Fowler' },
  });
  const martin = await prisma.author.upsert({
    where: { id: 'aaaaaaaa-0000-0000-0000-000000000002' },
    update: {},
    create: { id: 'aaaaaaaa-0000-0000-0000-000000000002', name: 'Robert C. Martin' },
  });

  // Books
  await prisma.book.createMany({
    data: [
      { title: 'Clean Code',       authorId: martin.id,  isbn: '9780132350884', totalCopies: 2, availableCopies: 2 },
      { title: 'The Clean Coder',  authorId: martin.id,  isbn: '9780137081073', totalCopies: 1, availableCopies: 1 },
      { title: 'Refactoring',      authorId: fowler.id,  isbn: '9780134757599', totalCopies: 3, availableCopies: 3 },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
```

- [ ] **Step 2: Run the seed**

Run: `npm run db:seed`
Expected: no errors.

- [ ] **Step 3: Verify Swagger end-to-end**

Run: `npm run start:dev` (in another shell or background).
Open `http://localhost:3000/api/docs`. Verify the four tag groups (`authors`, `books`, `search`, `reservations`) are present and routes are documented.
Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "chore(db): add seed script with users, authors, and a few books"
```

---

## Task 18: Integration test scaffolding

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
import { execSync } from 'node:child_process';

export default async function globalSetup(): Promise<void> {
  // Expects DATABASE_URL to point at a dedicated test database.
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ??
    'postgresql://library:library@localhost:5432/library_test?schema=public';
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
}
```

- [ ] **Step 3: Create `test/helpers/app.ts`**

```ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaExceptionFilter } from '../../src/common/filters/prisma-exception.filter';

export async function createTestingApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());
  await app.init();
  return app;
}
```

- [ ] **Step 4: Create `test/helpers/db.ts`**

```ts
import { PrismaClient } from '@prisma/client';

export async function resetDb(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE reservations, books, authors, users RESTART IDENTITY CASCADE',
  );
}

export async function seedUsers(prisma: PrismaClient, count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const u = await prisma.user.create({ data: { email: `u${i}-${Date.now()}@test.io` } });
    ids.push(u.id);
  }
  return ids;
}
```

- [ ] **Step 5: Create the test database locally**

Run: `docker compose exec db psql -U library -d postgres -c "CREATE DATABASE library_test"`
Expected: `CREATE DATABASE`.

- [ ] **Step 6: Apply migrations to the test database**

Run: `DATABASE_URL=postgresql://library:library@localhost:5432/library_test?schema=public npx prisma migrate deploy`
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add test/jest-e2e.config.ts test/globalSetup.ts test/helpers
git commit -m "test: add e2e scaffolding (testing module, DB reset helpers)"
```

---

## Task 19: Integration test — reservation lifecycle

**Files:**
- Create: `test/integration/reservation-lifecycle.e2e-spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestingApp } from '../helpers/app';
import { resetDb, seedUsers } from '../helpers/db';

describe('Reservation lifecycle', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let userId: string;
  let bookId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    app = await createTestingApp();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    [userId] = await seedUsers(prisma, 1);
    const author = await prisma.author.create({ data: { name: 'A' } });
    const book = await prisma.book.create({
      data: { title: 'Bk', authorId: author.id, isbn: '9780132350884', totalCopies: 1, availableCopies: 1 },
    });
    bookId = book.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('reserve -> check out -> return: available_copies toggles 1->0->0->1', async () => {
    // RESERVE
    const create = await request(app.getHttpServer())
      .post('/reservations')
      .set('X-User-Id', userId)
      .send({ bookId })
      .expect(201);
    expect(create.body.status).toBe('ACTIVE');
    let book = await prisma.book.findUnique({ where: { id: bookId } });
    expect(book?.availableCopies).toBe(0);

    // CHECK OUT
    const reservationId = create.body.id;
    const checkout = await request(app.getHttpServer())
      .post(`/reservations/${reservationId}/check-out`)
      .set('X-User-Id', userId)
      .expect(200);
    expect(checkout.body.status).toBe('CHECKED_OUT');
    expect(checkout.body.checkedOutAt).not.toBeNull();
    book = await prisma.book.findUnique({ where: { id: bookId } });
    expect(book?.availableCopies).toBe(0);

    // RETURN
    const returned = await request(app.getHttpServer())
      .post(`/reservations/${reservationId}/return`)
      .set('X-User-Id', userId)
      .expect(200);
    expect(returned.body.status).toBe('RETURNED');
    expect(returned.body.returnedAt).not.toBeNull();
    book = await prisma.book.findUnique({ where: { id: bookId } });
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

## Task 20: Integration test — concurrent reservation attempts

**Files:**
- Create: `test/integration/reservation-concurrent.e2e-spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestingApp } from '../helpers/app';
import { resetDb, seedUsers } from '../helpers/db';

describe('Concurrent reservations on the last copy', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let users: string[];
  let bookId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    app = await createTestingApp();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    users = await seedUsers(prisma, 10);
    const author = await prisma.author.create({ data: { name: 'A' } });
    const book = await prisma.book.create({
      data: { title: 'Bk', authorId: author.id, isbn: '9780132350884', totalCopies: 1, availableCopies: 1 },
    });
    bookId = book.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
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
    const statuses = responses.map((r) => r.status).sort();
    const successes = statuses.filter((s) => s === 201).length;
    const conflicts = statuses.filter((s) => s === 409).length;

    expect(successes).toBe(1);
    expect(conflicts).toBe(9);

    const book = await prisma.book.findUnique({ where: { id: bookId } });
    expect(book?.availableCopies).toBe(0);

    const active = await prisma.reservation.count({
      where: { bookId, status: 'ACTIVE' },
    });
    expect(active).toBe(1);
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

## Task 21: Search ranking integration tests

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

- [ ] **Step 2: Write the spec**

```ts
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestingApp } from '../helpers/app';
import { resetDb } from '../helpers/db';
import {
  CASE_1_BOOKS, CASE_3_BOOKS, CASE_4_BOOKS, CASE_5_BOOKS, SeedBook,
} from '../fixtures/search-cases';

async function seedBooks(prisma: PrismaClient, books: SeedBook[]): Promise<void> {
  for (const b of books) {
    const author = await prisma.author.upsert({
      where: { id: `00000000-0000-0000-0000-${b.authorName.length.toString().padStart(12, '0')}` },
      update: { name: b.authorName },
      create: {
        id: `00000000-0000-0000-0000-${b.authorName.length.toString().padStart(12, '0')}`,
        name: b.authorName,
      },
    });
    await prisma.book.create({
      data: {
        title: b.title, authorId: author.id, isbn: b.isbn,
        totalCopies: b.totalCopies, availableCopies: b.totalCopies,
      },
    });
  }
}

describe('Search ranking acceptance cases', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => { prisma = new PrismaClient(); app = await createTestingApp(); });
  beforeEach(async () => { await resetDb(prisma); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  it('Case 1: "clean code" ranks "Clean Code" first', async () => {
    await seedBooks(prisma, CASE_1_BOOKS);
    const res = await request(app.getHttpServer())
      .get('/search/books').query({ q: 'clean code' }).expect(200);
    expect(res.body.items[0].title).toBe('Clean Code');
  });

  it('Case 3: query "fowler" finds "Refactoring" via author', async () => {
    await seedBooks(prisma, CASE_3_BOOKS);
    const res = await request(app.getHttpServer())
      .get('/search/books').query({ q: 'fowler' }).expect(200);
    expect(res.body.items.map((b: { title: string }) => b.title)).toContain('Refactoring');
  });

  it('Case 4: hyphenated title tokenises ("domain driven" finds DDD)', async () => {
    await seedBooks(prisma, CASE_4_BOOKS);
    const res = await request(app.getHttpServer())
      .get('/search/books').query({ q: 'domain driven' }).expect(200);
    expect(res.body.items.map((b: { title: string }) => b.title)).toContain('Domain-Driven Design');
  });

  it('Case 5: identical-title ties broken deterministically by (title asc, id asc)', async () => {
    await seedBooks(prisma, CASE_5_BOOKS);
    const res = await request(app.getHttpServer())
      .get('/search/books').query({ q: 'patterns' }).expect(200);
    const ids = res.body.items.map((b: { id: string }) => b.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('Case 6: SQL-injection-shaped query returns no results, no error', async () => {
    await seedBooks(prisma, CASE_1_BOOKS);
    const res = await request(app.getHttpServer())
      .get('/search/books').query({ q: "'; DROP TABLE books; --" }).expect(200);
    expect(res.body.items).toEqual([]);
    // tables still exist:
    const count = await prisma.book.count();
    expect(count).toBe(CASE_1_BOOKS.length);
  });

  it('Case 7: empty q -> 400', async () => {
    await request(app.getHttpServer()).get('/search/books').query({ q: '' }).expect(400);
  });

  it('Case 8: stopword-only query -> empty result, not error', async () => {
    await seedBooks(prisma, CASE_1_BOOKS);
    const res = await request(app.getHttpServer())
      .get('/search/books').query({ q: 'the of' }).expect(200);
    expect(res.body.items).toEqual([]);
  });

  it('Case 9: pagination across many matching books', async () => {
    const author = await prisma.author.create({ data: { name: 'Bulk Author' } });
    for (let i = 0; i < 25; i++) {
      await prisma.book.create({
        data: {
          title: `Manual ${i.toString().padStart(2, '0')}`,
          authorId: author.id,
          isbn: `978${i.toString().padStart(10, '0')}`,
          totalCopies: 1,
          availableCopies: 1,
        },
      });
    }
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

## Task 22: GitHub Actions CI workflow

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
      - run: npx prisma generate
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
      DATABASE_URL: postgresql://library:library@localhost:5432/library_test?schema=public
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24.16.0
          cache: 'npm'
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma migrate deploy
      - run: npm run test:integration
```

- [ ] **Step 2: Document the branch protection setup in README**

Append to (or create) `README.md`:

```markdown
## Required status checks (manual one-time setup)

On GitHub, go to **Settings → Branches → Add rule** for `main`:
- Require pull request reviews before merging.
- **Require status checks to pass before merging.**
- Required checks: `lint-and-unit`, `integration`.
- Require branches to be up to date.

This blocks merging when the CI workflow fails.
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml README.md
git commit -m "ci: GH Actions workflow with lint+unit and integration jobs"
```

---

## Task 23: README and developer experience polish

**Files:**
- Create or modify: `README.md`

- [ ] **Step 1: Write the README**

```markdown
# Library Catalog

A minimal REST service for managing books, authors, and reservations.
Built with NestJS, Prisma, and Postgres 18.4. Full-text book search via
Postgres `tsvector` with `ts_rank_cd`-based ranking.

## Quick start

```bash
nvm use                    # Node 24.16.0
docker compose up -d db    # Postgres 18.4
cp .env.example .env
npm install
npx prisma migrate dev
npm run db:seed
npm run start:dev          # http://localhost:3000/api/docs
```

## Tests

- `npm run test:unit` — Jest unit tests (no DB).
- `npm run test:integration` — Jest + supertest against a real Postgres.

The integration tests expect a `library_test` database:
```bash
docker compose exec db psql -U library -d postgres -c "CREATE DATABASE library_test"
DATABASE_URL=postgresql://library:library@localhost:5432/library_test?schema=public \
  npx prisma migrate deploy
```

## Reservation concurrency rule

A book has N copies. At most N **ACTIVE or CHECKED_OUT** reservations can
exist for that book at once. Concurrent attempts on the last copy are
serialised by a single atomic SQL `UPDATE ... WHERE available_copies > 0
RETURNING`: exactly one wins (201), the others receive 409 Conflict.

## Required status checks (manual one-time setup)

(as above)
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with quickstart and concurrency rule overview"
```

---

## Self-review (post-write)

**Spec coverage.** Walking each spec section:
- §2 AC #1 (search ranking cases) → Tasks 15, 16, 21.
- §2 AC #2 (concurrency 1 success + N−1 conflicts) → Tasks 12, 13, 20.
- §2 AC #3 (CI blocks merging) → Task 22.
- §3 stack → Tasks 1, 2, 3, 22.
- §4 architecture + 4.1 concurrency strategy → Tasks 4, 13.
- §5 data model (tables, generated column, enum, indexes, constraints) → Task 3.
- §5.1 ranking formula → Task 16.
- §5.2 FSM → Task 12.
- §6 endpoints (authors, books, search, reservations) → Tasks 9, 11, 14, 16.
- §7 validation, exception filter, config → Tasks 1, 5.
- §8 testing strategy → Tasks 5, 6, 8, 10, 12, 13, 15, 18, 19, 20, 21.
- §8.3 ranking acceptance cases → Task 21 (cases 1, 3, 4, 5, 6, 7, 8, 9 explicitly; case 2 is covered by the same code path and tie-break rules verified in case 5).
- §8.4 CI workflow → Task 22.
- §9 project layout → all tasks.
- §10 dev experience → Tasks 2, 17, 23.

**Placeholder scan.** No TBD/TODO/"appropriate error handling"/"add validation" left. Every step contains the code or the exact command.

**Type/name consistency.** `availableCopies`/`totalCopies` (camelCase in TS, snake_case in SQL with explicit `@map`) used consistently. `ReservationStatus` enum used in service, DTO, and tests. `reservationTransition(current, action)` signature matches across `transition.ts`, `transition.spec.ts`, and `reservations.service.ts`. `BookEntity`/`AuthorEntity` referenced consistently.

No issues found.
