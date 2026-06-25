import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

declare global {
  // Persists the libSQL client across Next.js dev-mode HMR reloads so that
  // server action contexts don't pick up a stale, already-closed client.
  // eslint-disable-next-line no-var
  var __libsql_client: ReturnType<typeof createClient> | undefined;
}

const client = globalThis.__libsql_client ?? createClient({
  url: process.env.TURSO_DB_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.__libsql_client = client;
}

// SQLite ignores foreign keys by default; ON DELETE CASCADE requires this.
// Fire-and-forget is safe here: the pragma executes before any DML on this connection.
client.execute('PRAGMA foreign_keys = ON').catch((e) => {
  console.error('Failed to enable FK enforcement:', e);
});

export const db = drizzle(client, { schema });
