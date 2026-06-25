import { beforeAll, afterEach, describe, it, expect } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/db/schema';
import fs from 'fs';
import path from 'path';

const testClient = createClient({ url: 'file::memory:?cache=shared' });
const testDb = drizzle(testClient, { schema });

beforeAll(async () => {
  await testClient.execute('PRAGMA foreign_keys = ON');
  for (const file of [
    '0000_misty_khan.sql',
    '0001_maintenance_quality.sql',
    '0002_auth.sql',
  ]) {
    const sql = fs.readFileSync(
      path.resolve(process.cwd(), `src/db/migrations/${file}`),
      'utf-8',
    );
    await testClient.executeMultiple(sql);
  }
});

afterEach(async () => {
  await testDb.delete(schema.user);
});

describe('user table', () => {
  it('inserts a user and reads it back', async () => {
    await testDb.insert(schema.user).values({
      username: 'alice',
      displayName: 'Alice Admin',
      passwordHash: 'bcrypt-hash',
      role: 'ADMIN',
    });
    const [u] = await testDb.select().from(schema.user);
    expect(u.username).toBe('alice');
    expect(u.displayName).toBe('Alice Admin');
    expect(u.role).toBe('ADMIN');
    expect(u.lastLoginAt).toBeNull();
    expect(u.createdAt).toBeTruthy();
  });

  it('enforces unique username', async () => {
    await testDb
      .insert(schema.user)
      .values({ username: 'bob', displayName: 'Bob', passwordHash: 'h', role: 'VIEWER' });
    await expect(
      testDb
        .insert(schema.user)
        .values({ username: 'bob', displayName: 'Bob2', passwordHash: 'h', role: 'VIEWER' }),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('rejects invalid role', async () => {
    await expect(
      testClient.execute({
        sql: "INSERT INTO user (username, display_name, password_hash, role) VALUES (?, ?, ?, ?)",
        args: ['charlie', 'Charlie', 'h', 'SUPERUSER'],
      }),
    ).rejects.toThrow();
  });
});
