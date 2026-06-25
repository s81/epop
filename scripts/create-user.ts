import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../src/db/schema';
import bcrypt from 'bcryptjs';

function flag(name: string): string {
  const args = process.argv.slice(2);
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || !args[idx + 1]) {
    console.error(`Missing --${name}`);
    process.exit(1);
  }
  return args[idx + 1];
}

const username = flag('username');
const displayName = flag('display-name');
const roleRaw = flag('role');
const password = flag('password');

if (!schema.USER_ROLES.includes(roleRaw as schema.UserRole)) {
  console.error(`Invalid role. Must be one of: ${schema.USER_ROLES.join(', ')}`);
  process.exit(1);
}

const client = createClient({ url: process.env.TURSO_DB_URL || 'file:local.db' });
const db = drizzle(client, { schema });

const passwordHash = await bcrypt.hash(password, 12);

try {
  await db.insert(schema.user).values({
    username,
    displayName,
    role: roleRaw as schema.UserRole,
    passwordHash,
  });
  console.log(`✓ Created user "${username}" (${roleRaw})`);
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('UNIQUE')) {
    console.error(`User "${username}" already exists`);
  } else {
    console.error(msg);
  }
  process.exit(1);
} finally {
  client.close();
}
