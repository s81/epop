/**
 * Seed script — creates minimum data needed to demo the tablet screen.
 * Run: npx tsx scripts/seed.ts
 *
 * Safe to re-run: skips rows that already exist (matched by code).
 */
import { eq } from 'drizzle-orm';
import { db } from '../src/db/db';
import {
  department,
  workCenter,
  model,
  colorFamily,
  color,
  routingStep,
  workOrder,
  workOrderLine,
} from '../src/db/schema';
import { releaseWorkOrder } from '../src/db/operations';

async function upsert<T extends { id: number }>(
  label: string,
  existing: T | undefined,
  insert: () => Promise<T>,
): Promise<T> {
  if (existing) {
    console.log(`  skip  ${label} (id=${existing.id})`);
    return existing;
  }
  const row = await insert();
  console.log(`  + ${label} (id=${row.id})`);
  return row;
}

async function main() {
  console.log('Seeding e-pop demo data…\n');

  // --- Department (FAB already exists from migration) ---
  const [dept] = await db
    .select()
    .from(department)
    .where(eq(department.code, 'FAB'));
  const fab = await upsert('Department FAB', dept, async () => {
    const [r] = await db
      .insert(department)
      .values({ code: 'FAB', nameAr: 'التصنيع', nameEn: 'Fabrication' })
      .returning();
    return r;
  });

  // --- Work center ---
  const [wcRow] = await db
    .select()
    .from(workCenter)
    .where(eq(workCenter.code, 'WC-01'));
  const wc = await upsert('Work Center WC-01', wcRow, async () => {
    const [r] = await db
      .insert(workCenter)
      .values({
        code: 'WC-01',
        nameAr: 'محطة النجارة',
        nameEn: 'Carpentry Station',
        departmentId: fab.id,
        capacityPerShift: 1,
        bufferMinutes: 10,
      })
      .returning();
    return r;
  });

  // --- Model ---
  const [mdRow] = await db
    .select()
    .from(model)
    .where(eq(model.code, 'CHAIR-01'));
  const md = await upsert('Model CHAIR-01', mdRow, async () => {
    const [r] = await db
      .insert(model)
      .values({ code: 'CHAIR-01', nameAr: 'كرسي المدير', nameEn: 'Executive Chair' })
      .returning();
    return r;
  });

  // --- Color family + color (optional but nice for order lines) ---
  const [cfRow] = await db
    .select()
    .from(colorFamily)
    .where(eq(colorFamily.code, 'WOOD'));
  const cf = await upsert('Color Family WOOD', cfRow, async () => {
    const [r] = await db
      .insert(colorFamily)
      .values({ code: 'WOOD', nameAr: 'خشب', nameEn: 'Wood' })
      .returning();
    return r;
  });

  const [clRow] = await db
    .select()
    .from(color)
    .where(eq(color.code, 'OAK'));
  const cl = await upsert('Color OAK', clRow, async () => {
    const [r] = await db
      .insert(color)
      .values({ code: 'OAK', nameAr: 'بلوط', nameEn: 'Oak', colorFamilyId: cf.id })
      .returning();
    return r;
  });

  // --- Routing step: CHAIR-01 → WC-01 ---
  const [rsRow] = await db
    .select()
    .from(routingStep)
    .where(eq(routingStep.modelId, md.id));
  const rs = await upsert('Routing step CHAIR-01 → WC-01', rsRow, async () => {
    const [r] = await db
      .insert(routingStep)
      .values({
        modelId: md.id,
        workCenterId: wc.id,
        sequence: 10,
        manTimeMinutes: 30,
        machineTimeMinutes: 15,
        setupTimeMinutes: 5,
      })
      .returning();
    return r;
  });

  // --- Work order ---
  const [woRow] = await db
    .select()
    .from(workOrder)
    .where(eq(workOrder.orderNumber, 'PO-DEMO-001'));
  const wo = await upsert('Work Order PO-DEMO-001', woRow, async () => {
    const [r] = await db
      .insert(workOrder)
      .values({ orderNumber: 'PO-DEMO-001', status: 'DRAFT' })
      .returning();
    return r;
  });

  // --- Work order line ---
  const [wlRow] = await db
    .select()
    .from(workOrderLine)
    .where(eq(workOrderLine.workOrderId, wo.id));
  await upsert('Work Order Line (CHAIR-01 × 3)', wlRow, async () => {
    const [r] = await db
      .insert(workOrderLine)
      .values({ workOrderId: wo.id, modelId: md.id, colorId: cl.id, quantity: 3 })
      .returning();
    return r;
  });

  // --- Release (explodes routing into work_order_operation rows) ---
  const [fresh] = await db
    .select({ status: workOrder.status })
    .from(workOrder)
    .where(eq(workOrder.id, wo.id));
  if (fresh.status === 'DRAFT') {
    await releaseWorkOrder(wo.id);
    console.log('  + Released PO-DEMO-001 → operations created');
  } else {
    console.log(`  skip  Release (status=${fresh.status})`);
  }

  console.log('\nDone. Go to http://localhost:3000/tablet');
}

main().catch((e) => { console.error(e); process.exit(1); });
