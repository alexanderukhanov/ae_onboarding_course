import { relations, sql } from 'drizzle-orm';
import {
  check,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const reservationStatus = pgEnum('reservation_status', [
  'ACTIVE',
  'CHECKED_OUT',
  'RETURNED',
  'CANCELLED',
]);
/** Single source of truth for the status union, derived from the pgEnum. */
export type ReservationStatus = (typeof reservationStatus.enumValues)[number];

/** Statuses for which a copy is considered "in use" (not returned to the shelf). */
export const NON_TERMINAL_RESERVATION_STATUSES = [
  'ACTIVE',
  'CHECKED_OUT',
] satisfies readonly ReservationStatus[];

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
