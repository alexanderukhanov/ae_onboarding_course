import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { authors, books } from '../../db/schema';
import { DRIZZLE } from '../db/drizzle.token';
import type { Database } from '../../db/types';
import { AuthorEntity } from './dto/author.entity';

@Injectable()
export class AuthorsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findById(id: string): Promise<AuthorEntity | undefined> {
    return this.db.query.authors.findFirst({ where: eq(authors.id, id) });
  }

  async findPaged(
    page: number,
    pageSize: number,
  ): Promise<{ items: AuthorEntity[]; total: number }> {
    const [items, total] = await Promise.all([
      this.db
        .select()
        .from(authors)
        .orderBy(desc(authors.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.$count(authors),
    ]);
    return { items, total: Number(total) };
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
    const c = await this.db.$count(books, eq(books.authorId, authorId));
    return Number(c);
  }
}
