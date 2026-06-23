import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const client = createClient({
  url: process.env.TURSO_DB_URL ?? 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// SQLite ignores foreign keys by default; ON DELETE CASCADE requires this.
// Fire-and-forget is safe here: the pragma executes before any DML on this connection.
client.execute('PRAGMA foreign_keys = ON').catch((e) => {
  console.error('Failed to enable FK enforcement:', e);
});

export const db = drizzle(client, { schema });
