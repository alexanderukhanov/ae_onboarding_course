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
        title: 'Bk',
        authorId: author!.id,
        isbn: '9780132350884',
        totalCopies: 1,
        availableCopies: 1,
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
