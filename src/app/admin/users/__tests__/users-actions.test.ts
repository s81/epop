import { beforeAll, afterEach, describe, it, expect, vi } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/db/schema';
import fs from 'fs';
import path from 'path';

// Unique in-memory DB for this test file
const testClient = createClient({ url: 'file::memory:?cache=shared' });
const testDb = drizzle(testClient, { schema });

// Action references populated in beforeAll after mocks are registered
let saveUser: (prev: unknown, fd: FormData) => Promise<{ success: true } | { error: string }>;
let deleteUser: (fd: FormData) => Promise<void>;

beforeAll(async () => {
  // vi.doMock (no transform hoisting) — factory runs in order, so testDb is already defined.
  // The dynamic import below loads actions.ts, which in turn imports @/db/db;
  // vitest resolves that import through this mock factory.
  vi.doMock('@/db/db', () => ({ db: testDb }));
  vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }));
  vi.doMock('@/lib/auth', () => ({
    requireRole: vi.fn().mockResolvedValue({ userId: 999, role: 'ADMIN', displayName: 'Test Admin' }),
    UnauthorizedError: class UnauthorizedError extends Error {},
  }));

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

  // Dynamic import AFTER mocks are set up — first load of actions.ts picks up
  // the mocked @/db/db instead of the real one.
  const actions = await import('@/app/admin/users/actions');
  saveUser = actions.saveUser;
  deleteUser = actions.deleteUser;
});

afterEach(async () => {
  await testDb.delete(schema.user);
});

describe('saveUser', () => {
  it('creates a new user with a hashed password', async () => {
    const fd = new FormData();
    fd.set('username', 'alice');
    fd.set('displayName', 'Alice');
    fd.set('role', 'DATA_ENTRY');
    fd.set('password', 'secret123');

    const result = await saveUser(null, fd);
    expect(result).toEqual({ success: true });

    const [u] = await testDb.select().from(schema.user);
    expect(u.username).toBe('alice');
    expect(u.role).toBe('DATA_ENTRY');
    expect(u.passwordHash).not.toBe('secret123');
    expect(u.passwordHash.startsWith('$2')).toBe(true);
  });

  it('returns error when password is missing for new user', async () => {
    const fd = new FormData();
    fd.set('username', 'bob');
    fd.set('displayName', 'Bob');
    fd.set('role', 'VIEWER');
    fd.set('password', '');

    const result = await saveUser(null, fd);
    expect(result).toMatchObject({ error: expect.stringContaining('Password') });
  });

  it('returns error on duplicate username', async () => {
    await testDb.insert(schema.user).values({
      username: 'charlie',
      displayName: 'Charlie',
      passwordHash: 'h',
      role: 'VIEWER',
    });

    const fd = new FormData();
    fd.set('username', 'charlie');
    fd.set('displayName', 'Charlie 2');
    fd.set('role', 'VIEWER');
    fd.set('password', 'abc123');

    const result = await saveUser(null, fd);
    expect(result).toMatchObject({ error: expect.stringContaining('already exists') });
  });

  it('updates display name and role without changing password when password blank', async () => {
    const [inserted] = await testDb
      .insert(schema.user)
      .values({ username: 'diana', displayName: 'Diana', passwordHash: 'original-hash', role: 'VIEWER' })
      .returning();

    const fd = new FormData();
    fd.set('id', String(inserted.id));
    fd.set('username', 'diana');
    fd.set('displayName', 'Diana Updated');
    fd.set('role', 'DATA_ENTRY');
    fd.set('password', '');

    const result = await saveUser(null, fd);
    expect(result).toEqual({ success: true });

    const [u] = await testDb.select().from(schema.user);
    expect(u.displayName).toBe('Diana Updated');
    expect(u.role).toBe('DATA_ENTRY');
    expect(u.passwordHash).toBe('original-hash');
  });
});

describe('deleteUser', () => {
  it('deletes another user', async () => {
    const [other] = await testDb
      .insert(schema.user)
      .values({ username: 'eve', displayName: 'Eve', passwordHash: 'h', role: 'VIEWER' })
      .returning();

    const fd = new FormData();
    fd.set('id', String(other.id));
    await deleteUser(fd);

    const all = await testDb.select().from(schema.user);
    expect(all).toHaveLength(0);
  });

  it('throws when trying to delete own account', async () => {
    const fd = new FormData();
    fd.set('id', '999'); // matches mocked session.userId
    await expect(deleteUser(fd)).rejects.toThrow('Cannot delete your own account');
  });
});
