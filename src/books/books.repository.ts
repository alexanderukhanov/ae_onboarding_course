import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { authors, books, NON_TERMINAL_RESERVATION_STATUSES, reservations } from '../../db/schema';
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
    return this.db.query.authors.findFirst({
      where: eq(authors.id, id),
      columns: { id: true },
    });
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
    return (await this.findById(row!.id))!;
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
      and(
        eq(reservations.bookId, bookId),
        inArray(reservations.status, NON_TERMINAL_RESERVATION_STATUSES),
      ),
    );
    return Number(c);
  }
}
