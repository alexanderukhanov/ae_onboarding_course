import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

async function main(): Promise<void> {
  const client = postgres(process.env['DATABASE_URL']!);
  const db = drizzle(client, { schema });

  await db
    .insert(schema.users)
    .values([
      { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', email: 'alice@example.com' },
      { id: 'a8098c1a-f86e-461c-a18f-2e3a47b4d2a3', email: 'bob@example.com' },
      { id: 'b8f8b8c8-1234-4567-8a9b-1234567890ab', email: 'carol@example.com' },
    ])
    .onConflictDoNothing();

  const fowlerId = '01234567-89ab-4cde-9f01-234567890001';
  const martinId = '01234567-89ab-4cde-9f01-234567890002';

  await db
    .insert(schema.authors)
    .values([
      { id: fowlerId, name: 'Martin Fowler' },
      { id: martinId, name: 'Robert C. Martin' },
    ])
    .onConflictDoNothing();

  await db
    .insert(schema.books)
    .values([
      {
        title: 'Clean Code',
        authorId: martinId,
        isbn: '9780132350884',
        totalCopies: 2,
        availableCopies: 2,
      },
      {
        title: 'The Clean Coder',
        authorId: martinId,
        isbn: '9780137081073',
        totalCopies: 1,
        availableCopies: 1,
      },
      {
        title: 'Refactoring',
        authorId: fowlerId,
        isbn: '9780134757599',
        totalCopies: 3,
        availableCopies: 3,
      },
    ])
    .onConflictDoNothing();

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
