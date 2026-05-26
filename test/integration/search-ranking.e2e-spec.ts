import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as schema from '../../db/schema';
import {
  CASE_1_BOOKS,
  CASE_3_BOOKS,
  CASE_4_BOOKS,
  CASE_5_BOOKS,
  SeedBook,
} from '../fixtures/search-cases';
import { createTestingApp } from '../helpers/app';
import { createTestDb, resetDb, TestDb } from '../helpers/db';

async function seedBooks(tdb: TestDb, items: SeedBook[]): Promise<void> {
  const authorIdByName = new Map<string, string>();
  for (const b of items) {
    let authorId = authorIdByName.get(b.authorName);
    if (!authorId) {
      const [a] = await tdb.db.insert(schema.authors).values({ name: b.authorName }).returning();
      authorId = a!.id;
      authorIdByName.set(b.authorName, authorId);
    }
    await tdb.db.insert(schema.books).values({
      title: b.title,
      authorId,
      isbn: b.isbn,
      totalCopies: b.totalCopies,
      availableCopies: b.totalCopies,
    });
  }
}

describe('Search ranking acceptance cases', () => {
  let app: INestApplication;
  let tdb: TestDb;

  beforeAll(async () => {
    tdb = createTestDb();
    app = await createTestingApp();
  });
  beforeEach(async () => {
    await resetDb(tdb.client);
  });
  afterAll(async () => {
    await app.close();
    await tdb.client.end();
  });

  it('Case 1: "clean code" ranks "Clean Code" first', async () => {
    await seedBooks(tdb, CASE_1_BOOKS);
    const res = await request(app.getHttpServer())
      .get('/search/books')
      .query({ q: 'clean code' })
      .expect(200);
    expect(res.body.items[0].title).toBe('Clean Code');
  });

  it('Case 3: query "fowler" finds "Refactoring" via author', async () => {
    await seedBooks(tdb, CASE_3_BOOKS);
    const res = await request(app.getHttpServer())
      .get('/search/books')
      .query({ q: 'fowler' })
      .expect(200);
    expect(res.body.items.map((b: { title: string }) => b.title)).toContain('Refactoring');
  });

  it('Case 4: hyphenated title tokenises ("domain driven" finds DDD)', async () => {
    await seedBooks(tdb, CASE_4_BOOKS);
    const res = await request(app.getHttpServer())
      .get('/search/books')
      .query({ q: 'domain driven' })
      .expect(200);
    expect(res.body.items.map((b: { title: string }) => b.title)).toContain('Domain-Driven Design');
  });

  it('Case 5: identical-title ties broken deterministically by (title asc, id asc)', async () => {
    await seedBooks(tdb, CASE_5_BOOKS);
    const res = await request(app.getHttpServer())
      .get('/search/books')
      .query({ q: 'patterns' })
      .expect(200);
    const ids: string[] = res.body.items.map((b: { id: string }) => b.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('Case 6: SQL-injection-shaped query returns no results, no error', async () => {
    await seedBooks(tdb, CASE_1_BOOKS);
    const res = await request(app.getHttpServer())
      .get('/search/books')
      .query({ q: "'; DROP TABLE books; --" })
      .expect(200);
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
      .get('/search/books')
      .query({ q: 'the of' })
      .expect(200);
    expect(res.body.items).toEqual([]);
  });

  it('Case 9: pagination across many matching books', async () => {
    const [author] = await tdb.db
      .insert(schema.authors)
      .values({ name: 'Bulk Author' })
      .returning();
    const values = Array.from({ length: 25 }, (_, i) => ({
      title: `Manual ${i.toString().padStart(2, '0')}`,
      authorId: author!.id,
      isbn: `978${i.toString().padStart(10, '0')}`,
      totalCopies: 1,
      availableCopies: 1,
    }));
    await tdb.db.insert(schema.books).values(values);
    const res = await request(app.getHttpServer())
      .get('/search/books')
      .query({ q: 'manual', page: 2, pageSize: 10 })
      .expect(200);
    expect(res.body.total).toBe(25);
    expect(res.body.items).toHaveLength(10);
  });
});
