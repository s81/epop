import { beforeAll, afterEach, describe, it, expect, vi } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/db/schema';
import fs from 'fs';
import path from 'path';

// Unique in-memory DB for this test file
const testClient = createClient({ url: 'file::memory:?cache=shared' });
const testDb = drizzle(testClient, { schema });

let recordReceipt: (prev: unknown, fd: FormData) => Promise<{ success: true } | { error: string }>;
let recordIssue: (prev: unknown, fd: FormData) => Promise<{ success: true } | { error: string }>;
let recordAdjustment: (prev: unknown, fd: FormData) => Promise<{ success: true } | { error: string }>;

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'src/db/migrations');
const MIGRATIONS = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

let categoryId: number;
let materialId: number;

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

  const actions = await import('@/app/admin/inventory/actions');
  recordReceipt = actions.recordReceipt;
  recordIssue = actions.recordIssue;
  recordAdjustment = actions.recordAdjustment;

  const [cat] = await testDb.insert(schema.materialCategory)
    .values({ code: 'HW', nameAr: 'أجهزة', nameEn: 'Hardware' })
    .returning();
  categoryId = cat.id;

  const [mat] = await testDb.insert(schema.material)
    .values({ code: 'STL-LG', nameAr: 'أرجل معدنية', nameEn: 'Steel Legs', unit: 'pcs', categoryId })
    .returning();
  materialId = mat.id;
});

afterEach(async () => {
  await testDb.delete(schema.stockTransaction);
});

describe('recordReceipt', () => {
  it('records a positive receipt with the actor from the session', async () => {
    const fd = new FormData();
    fd.set('materialId', String(materialId));
    fd.set('quantity', '50');
    fd.set('reference', 'PO-1');

    const result = await recordReceipt(null, fd);
    expect(result).toEqual({ success: true });

    const [tx] = await testDb.select().from(schema.stockTransaction);
    expect(tx.quantity).toBe(50);
    expect(tx.type).toBe('RECEIPT');
    expect(tx.createdBy).toBe('Test Operator');
  });

  it('rejects a non-finite quantity', async () => {
    const fd = new FormData();
    fd.set('materialId', String(materialId));
    fd.set('quantity', 'Infinity');

    const result = await recordReceipt(null, fd);
    expect(result).toMatchObject({ error: expect.stringContaining('positive') });
  });
});

describe('recordIssue', () => {
  it('stores the quantity as negative and records the actor', async () => {
    const fd = new FormData();
    fd.set('materialId', String(materialId));
    fd.set('quantity', '10');

    const result = await recordIssue(null, fd);
    expect(result).toEqual({ success: true });

    const [tx] = await testDb.select().from(schema.stockTransaction);
    expect(tx.quantity).toBe(-10);
    expect(tx.type).toBe('ISSUE');
    expect(tx.createdBy).toBe('Test Operator');
  });
});

describe('recordAdjustment', () => {
  it('accepts a negative quantity (write-down)', async () => {
    const fd = new FormData();
    fd.set('materialId', String(materialId));
    fd.set('quantity', '-7');
    fd.set('note', 'damaged stock');

    const result = await recordAdjustment(null, fd);
    expect(result).toEqual({ success: true });

    const [tx] = await testDb.select().from(schema.stockTransaction);
    expect(tx.quantity).toBe(-7);
    expect(tx.type).toBe('ADJUSTMENT');
    expect(tx.createdBy).toBe('Test Operator');
  });

  it('accepts a positive quantity (write-up)', async () => {
    const fd = new FormData();
    fd.set('materialId', String(materialId));
    fd.set('quantity', '3');

    const result = await recordAdjustment(null, fd);
    expect(result).toEqual({ success: true });
  });
});

describe('stock_transaction sign CHECK constraint', () => {
  it('rejects a RECEIPT row with a non-positive quantity at the DB level', async () => {
    await expect(
      testDb.insert(schema.stockTransaction).values({
        materialId,
        type: 'RECEIPT',
        quantity: -1,
      }),
    ).rejects.toMatchObject({ cause: { message: expect.stringContaining('CHECK') } });
  });

  it('rejects an ISSUE row with a non-negative quantity at the DB level', async () => {
    await expect(
      testDb.insert(schema.stockTransaction).values({
        materialId,
        type: 'ISSUE',
        quantity: 1,
      }),
    ).rejects.toMatchObject({ cause: { message: expect.stringContaining('CHECK') } });
  });
});
