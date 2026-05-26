import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export default async function globalSetup(): Promise<void> {
  process.env['DATABASE_URL'] =
    process.env['DATABASE_URL'] ??
    'postgresql://library:library@localhost:5432/library_test';

  const client = postgres(process.env['DATABASE_URL']!, { max: 1 });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: './db/migrations' });
  await client.end();
}
