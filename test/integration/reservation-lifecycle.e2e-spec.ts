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
    userId = (await seedUsers(tdb.db, 1))[0]!;
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
      .post('/reservations')
      .set('X-User-Id', userId)
      .send({ bookId })
      .expect(201);
    const id = create.body.id;
    await request(app.getHttpServer())
      .post(`/reservations/${id}/check-out`)
      .set('X-User-Id', userId)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/reservations/${id}/return`)
      .set('X-User-Id', userId)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/reservations/${id}/check-out`)
      .set('X-User-Id', userId)
      .expect(409);
  });
});
