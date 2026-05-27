import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql, SQL } from 'drizzle-orm';
import { books, reservations } from '../../db/schema';
import { DRIZZLE } from '../db/drizzle.token';
import type { Database, DbTransaction } from '../../db/types';
import { ReservationEntity } from './dto/reservation.entity';
import { ReservationStatus } from './transition';

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
    const found = await tx.query.books.findFirst({
      where: eq(books.id, bookId),
      columns: { id: true },
    });
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
    const [row] = await tx
      .update(reservations)
      .set(data)
      .where(eq(reservations.id, id))
      .returning();
    return row!;
  }

  async findByIdInTx(tx: DbTransaction, id: string): Promise<ReservationEntity | undefined> {
    return tx.query.reservations.findFirst({ where: eq(reservations.id, id) });
  }

  withTransaction<T>(cb: (tx: DbTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(cb);
  }
}
