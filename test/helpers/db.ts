import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { Sql } from 'postgres';
import * as schema from '../../db/schema';

export interface TestDb {
  db: ReturnType<typeof drizzle<typeof schema>>;
  client: Sql;
}

export function createTestDb(): TestDb {
  const client = postgres(process.env['DATABASE_URL']!);
  const db = drizzle(client, { schema });
  return { db, client };
}

export async function resetDb(client: Sql): Promise<void> {
  await client`TRUNCATE TABLE reservations, books, authors, users RESTART IDENTITY CASCADE`;
}

export async function seedUsers(
  db: ReturnType<typeof drizzle<typeof schema>>,
  count: number,
): Promise<string[]> {
  const inserted = await db
    .insert(schema.users)
    .values(
      Array.from({ length: count }, (_, i) => ({ email: `u${i}-${Date.now()}@test.io` })),
    )
    .returning();
  return inserted.map((u) => u.id);
}
