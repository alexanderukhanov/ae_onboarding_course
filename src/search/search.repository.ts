import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.token';
import type { Database } from '../../db/types';
import { BookWithScoreEntity } from './dto/book-with-score.entity';

interface Row extends Record<string, unknown> {
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

interface CountRow extends Record<string, unknown> {
  count: string;
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

    const totalRows = await this.db.execute<CountRow>(sql`
      WITH query AS (SELECT plainto_tsquery('simple', ${q}) AS qry)
      SELECT count(*)::text AS count
      FROM books b
      JOIN authors a ON a.id = b.author_id
      CROSS JOIN query
      WHERE (b.search_vector @@ query.qry
             OR to_tsvector('simple', a.name) @@ query.qry)
        AND (${authorId}::uuid IS NULL OR b.author_id = ${authorId}::uuid)`);

    const items = rows.map(
      (r): BookWithScoreEntity => ({
        id: r.id,
        title: r.title,
        authorId: r.author_id,
        isbn: r.isbn,
        totalCopies: r.total_copies,
        availableCopies: r.available_copies,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        score: Number(r.score),
      }),
    );
    const total = Number(totalRows[0]?.count ?? '0');
    return { items, total };
  }
}
