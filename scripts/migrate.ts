import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';

const DB_URL = process.env.TURSO_DB_URL || 'file:local.db';
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

async function migrate() {
  const client = createClient({ url: DB_URL, authToken: AUTH_TOKEN });

  const migrationsDir = path.resolve(process.cwd(), 'src/db/migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  await client.execute('PRAGMA foreign_keys = ON');

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);

    for (const stmt of statements) {
      try {
        await client.execute(stmt);
        console.log(`  \u2713 ${file}: ${stmt.slice(0, 60)}...`);
      } catch (e) {
        if (e instanceof Error && (e.message.includes('already exists') || e.message.includes('UNIQUE'))) {
          console.log(`  - ${file}: ${stmt.slice(0, 60)}... (skipped)`);
        } else {
          throw e;
        }
      }
    }
  }

  console.log('Migrations complete.');
  process.exit(0);
}

migrate().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
