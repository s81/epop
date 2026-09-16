import { beforeAll, afterEach, describe, it, expect, vi } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/db/schema';
import fs from 'fs';
import path from 'path';

const testClient = createClient({ url: 'file::memory:?cache=shared' });
const testDb = drizzle(testClient, { schema });

let deleteMaterial: typeof import('@/app/admin/materials/actions').deleteMaterial;
let saveMaterial: typeof import('@/app/admin/materials/actions').saveMaterial;

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'src/db/migrations');
const MIGRATIONS = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

let categoryId: number;

beforeAll(async () => {
  vi.doMock('@/db/db', () => ({ db: testDb }));
  vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }));
  vi.doMock('@/lib/auth', () => ({
    requireRole: vi.fn().mockResolvedValue({ userId: 1, role: 'DATA_ENTRY', displayName: 'Test Operator' }),
    UnauthorizedError: class UnauthorizedError extends Error {},
  }));

  await testClient.execute('PRAGMA foreign_keys = ON');
  for (const file of MIGRATIONS) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    await testClient.executeMultiple(sql);
  }

  const actions = await import('@/app/admin/materials/actions');
  deleteMaterial = actions.deleteMaterial;
  saveMaterial = actions.saveMaterial;

  const [cat] = await testDb.insert(schema.materialCategory)
    .values({ code: 'HW', nameAr: 'أجهزة', nameEn: 'Hardware' })
    .returning();
  categoryId = cat.id;
});

afterEach(async () => {
  await testDb.delete(schema.stockTransaction);
  await testDb.delete(schema.material);
});

describe('saveMaterial', () => {
  it('returns a friendly "already exists" message on a duplicate code', async () => {
    await testDb.insert(schema.material)
      .values({ code: 'DUP-1', nameAr: 'أ', nameEn: 'A', unit: 'pcs', categoryId })
      .returning();

    const fd = new FormData();
    fd.set('code', 'dup-1');
    fd.set('nameAr', 'ب');
    fd.set('nameEn', 'B');
    fd.set('unit', 'pcs');
    fd.set('categoryId', String(categoryId));

    const result = await saveMaterial(null, fd);
    expect(result).toEqual({ error: 'Code "DUP-1" already exists' });
  });
});

describe('deleteMaterial', () => {
  it('deletes a material with no transactions', async () => {
    const [mat] = await testDb.insert(schema.material)
      .values({ code: 'FREE-1', nameAr: 'حر', nameEn: 'Free', unit: 'pcs', categoryId })
      .returning();

    const fd = new FormData();
    fd.set('id', String(mat.id));
    await deleteMaterial(fd);

    const all = await testDb.select().from(schema.material);
    expect(all).toHaveLength(0);
  });

  it('returns a friendly error instead of a raw FK message when the material has stock transactions', async () => {
    const [mat] = await testDb.insert(schema.material)
      .values({ code: 'USED-1', nameAr: 'مستخدم', nameEn: 'Used', unit: 'pcs', categoryId })
      .returning();
    await testDb.insert(schema.stockTransaction).values({
      materialId: mat.id,
      type: 'RECEIPT',
      quantity: 5,
    });

    const fd = new FormData();
    fd.set('id', String(mat.id));
    await expect(deleteMaterial(fd)).resolves.toMatchObject({ error: expect.stringContaining('Cannot delete') });
  });
});
