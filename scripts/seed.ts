/**
 * Comprehensive demo seed — creates realistic Maani office-furniture data.
 * Safe to re-run: skips rows that already exist (matched by code/order number).
 *
 * Run: npx tsx scripts/seed.ts
 */
import { eq, and, asc } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../src/db/db';
import {
  department, workCenter, model, colorFamily, color, routingStep,
  workOrder, workOrderLine, workOrderOperation, operationEvent,
  shiftCalendar,
  user, materialCategory, material, stockTransaction,
} from '../src/db/schema';
import { releaseWorkOrder, applyEvent } from '../src/db/operations';
import { clearSchedule, runScheduler } from '../src/db/scheduler';

async function upsert<T extends { id: number }>(
  label: string,
  existing: T | undefined,
  insert: () => Promise<T>,
): Promise<T> {
  if (existing) { console.log(`  · ${label}`); return existing; }
  const row = await insert();
  console.log(`  + ${label}`);
  return row;
}

async function main() {
  console.log('Seeding e-pop demo data…\n');

  // ── Departments ───────────────────────────────────────────────────
  const deptData = [
    { code: 'FAB', nameAr: 'التصنيع',           nameEn: 'Fabrication' },
    { code: 'FIN', nameAr: 'التشطيب',            nameEn: 'Finishing' },
    { code: 'ASM', nameAr: 'التجميع',            nameEn: 'Assembly' },
    { code: 'PKG', nameAr: 'التغليف والتخزين',   nameEn: 'Packaging & Storage' },
  ];
  const depts: Record<string, typeof department.$inferSelect> = {};
  for (const d of deptData) {
    const [row] = await db.select().from(department).where(eq(department.code, d.code));
    depts[d.code] = await upsert(`Department ${d.code}`, row, async () => {
      const [r] = await db.insert(department).values(d).returning();
      return r;
    });
  }

  // ── Work Centers ──────────────────────────────────────────────────
  const wcData = [
    { code: 'CNC-01', nameAr: 'CNC 1',                nameEn: 'CNC Router 1',        dept: 'FAB', cap: 1, buf: 15 },
    { code: 'CNC-02', nameAr: 'CNC 2',                nameEn: 'CNC Router 2',        dept: 'FAB', cap: 1, buf: 15 },
    { code: 'EDG-01', nameAr: 'تلييس',                nameEn: 'Edge Banding',        dept: 'FAB', cap: 1, buf: 10 },
    { code: 'SND-01', nameAr: 'تجليخ',                nameEn: 'Sanding',             dept: 'FIN', cap: 2, buf: 10 },
    { code: 'PNT-01', nameAr: 'دهان',                 nameEn: 'Painting Booth',      dept: 'FIN', cap: 1, buf: 30 },
    { code: 'DRL-01', nameAr: 'تثقيب وتجميع',        nameEn: 'Drilling & Assembly', dept: 'ASM', cap: 2, buf: 10 },
    { code: 'QC-01',  nameAr: 'فحص الجودة',           nameEn: 'Quality Inspection',  dept: 'ASM', cap: 1, buf: 5  },
    { code: 'PKG-01', nameAr: 'تغليف',                nameEn: 'Packaging',           dept: 'PKG', cap: 2, buf: 10 },
  ];
  const wcs: Record<string, typeof workCenter.$inferSelect> = {};
  for (const w of wcData) {
    const [row] = await db.select().from(workCenter).where(eq(workCenter.code, w.code));
    wcs[w.code] = await upsert(`Work Center ${w.code}`, row, async () => {
      const [r] = await db.insert(workCenter).values({
        code: w.code, nameAr: w.nameAr, nameEn: w.nameEn,
        departmentId: depts[w.dept].id,
        capacityPerShift: w.cap, bufferMinutes: w.buf,
      }).returning();
      return r;
    });
  }

  // ── Models ────────────────────────────────────────────────────────
  const modelData = [
    { code: 'DESK-01', nameAr: 'مكتب تنفيذي',       nameEn: 'Executive Desk' },
    { code: 'DESK-02', nameAr: 'مكتب مساعد',        nameEn: 'Auxiliary Desk' },
    { code: 'CHAR-01', nameAr: 'كرسي مدير',         nameEn: 'Executive Chair' },
    { code: 'CHAR-02', nameAr: 'كرسي موظف',         nameEn: 'Task Chair' },
    { code: 'CAB-01',  nameAr: 'خزانة ملفات',       nameEn: 'Filing Cabinet' },
  ];
  const models: Record<string, typeof model.$inferSelect> = {};
  for (const m of modelData) {
    const [row] = await db.select().from(model).where(eq(model.code, m.code));
    models[m.code] = await upsert(`Model ${m.code}`, row, async () => {
      const [r] = await db.insert(model).values(m).returning();
      return r;
    });
  }

  // ── Color Families ────────────────────────────────────────────────
  const cfData = [
    { code: 'WOOD', nameAr: 'خشب',            nameEn: 'Wood Veneer' },
    { code: 'LAM',  nameAr: 'صفح',            nameEn: 'Laminate' },
    { code: 'FAB',  nameAr: 'قماش',           nameEn: 'Fabric' },
  ];
  const cfs: Record<string, typeof colorFamily.$inferSelect> = {};
  for (const c of cfData) {
    const [row] = await db.select().from(colorFamily).where(eq(colorFamily.code, c.code));
    cfs[c.code] = await upsert(`Color Family ${c.code}`, row, async () => {
      const [r] = await db.insert(colorFamily).values(c).returning();
      return r;
    });
  }

  // ── Colors ────────────────────────────────────────────────────────
  const colorData = [
    { code: 'OAK',    nameAr: 'بلوط',          nameEn: 'Oak',         family: 'WOOD' },
    { code: 'WAL',    nameAr: 'جوز',            nameEn: 'Walnut',      family: 'WOOD' },
    { code: 'WHT',    nameAr: 'أبيض',           nameEn: 'White',       family: 'LAM' },
    { code: 'GRY',    nameAr: 'رمادي',          nameEn: 'Grey',        family: 'LAM' },
    { code: 'BLK',    nameAr: 'أسود',           nameEn: 'Black',       family: 'FAB' },
    { code: 'BLU',    nameAr: 'أزرق',           nameEn: 'Blue',        family: 'FAB' },
  ];
  const colors: Record<string, typeof color.$inferSelect> = {};
  for (const c of colorData) {
    const [row] = await db.select().from(color).where(eq(color.code, c.code));
    colors[c.code] = await upsert(`Color ${c.code}`, row, async () => {
      const [r] = await db.insert(color).values({
        code: c.code, nameAr: c.nameAr, nameEn: c.nameEn,
        colorFamilyId: cfs[c.family].id,
      }).returning();
      return r;
    });
  }

  // ── Routing Steps ─────────────────────────────────────────────────
  type RSInput = { model: string; seq: number; wc: string; man: number; mach: number; setup: number };
  const rsData: RSInput[] = [
    // Executive Desk: CNC → Edge Band → Sand → Paint → Drill → QC → Package
    { model: 'DESK-01', seq: 10, wc: 'CNC-01', man: 45, mach: 30, setup: 15 },
    { model: 'DESK-01', seq: 20, wc: 'EDG-01', man: 20, mach: 15, setup: 10 },
    { model: 'DESK-01', seq: 30, wc: 'SND-01', man: 25, mach: 20, setup: 10 },
    { model: 'DESK-01', seq: 40, wc: 'PNT-01', man: 60, mach: 45, setup: 20 },
    { model: 'DESK-01', seq: 50, wc: 'DRL-01', man: 30, mach: 20, setup: 10 },
    { model: 'DESK-01', seq: 60, wc: 'QC-01',  man: 15, mach: 0,  setup: 0  },
    { model: 'DESK-01', seq: 70, wc: 'PKG-01', man: 20, mach: 10, setup: 5  },
    // Task Chair: CNC2 → Drill → QC → Package
    { model: 'CHAR-02', seq: 10, wc: 'CNC-02', man: 30, mach: 20, setup: 10 },
    { model: 'CHAR-02', seq: 20, wc: 'DRL-01', man: 25, mach: 15, setup: 10 },
    { model: 'CHAR-02', seq: 30, wc: 'QC-01',  man: 10, mach: 0,  setup: 0  },
    { model: 'CHAR-02', seq: 40, wc: 'PKG-01', man: 15, mach: 5,  setup: 5  },
    // Filing Cabinet: CNC2 → Edge → Sand → Paint → Drill → QC → Package
    { model: 'CAB-01',  seq: 10, wc: 'CNC-02', man: 35, mach: 25, setup: 10 },
    { model: 'CAB-01',  seq: 20, wc: 'EDG-01', man: 15, mach: 10, setup: 5  },
    { model: 'CAB-01',  seq: 30, wc: 'SND-01', man: 20, mach: 15, setup: 5  },
    { model: 'CAB-01',  seq: 40, wc: 'PNT-01', man: 40, mach: 30, setup: 15 },
    { model: 'CAB-01',  seq: 50, wc: 'DRL-01', man: 20, mach: 15, setup: 5  },
    { model: 'CAB-01',  seq: 60, wc: 'QC-01',  man: 10, mach: 0,  setup: 0  },
    { model: 'CAB-01',  seq: 70, wc: 'PKG-01', man: 15, mach: 5,  setup: 5  },
  ];
  for (const rs of rsData) {
    const [row] = await db
      .select()
      .from(routingStep)
      .where(and(eq(routingStep.modelId, models[rs.model].id), eq(routingStep.sequence, rs.seq)));
    await upsert(`Routing ${rs.model} seq=${rs.seq} → ${rs.wc}`, row, async () => {
      const [r] = await db.insert(routingStep).values({
        modelId: models[rs.model].id,
        workCenterId: wcs[rs.wc].id,
        sequence: rs.seq,
        manTimeMinutes: rs.man,
        machineTimeMinutes: rs.mach,
        setupTimeMinutes: rs.setup,
      }).returning();
      return r;
    });
  }

  // ── Users ─────────────────────────────────────────────────────────
  const userData = [
    { username: 'admin',   displayName: 'مدير النظام / Admin',     role: 'ADMIN' as const,     password: 'admin123' },
    { username: 'operator', displayName: 'مشغل / Operator',        role: 'DATA_ENTRY' as const, password: 'op123' },
    { username: 'viewer',  displayName: 'مشاهد / Viewer',          role: 'VIEWER' as const,     password: 'view123' },
  ];
  for (const u of userData) {
    const [row] = await db.select().from(user).where(eq(user.username, u.username));
    await upsert(`User ${u.username}`, row, async () => {
      const [r] = await db.insert(user).values({
        username: u.username, displayName: u.displayName,
        role: u.role, passwordHash: await bcrypt.hash(u.password, 12),
      }).returning();
      return r;
    });
  }

  // ── Work Orders ───────────────────────────────────────────────────
  // Reference: DESK-01 executive desks in Walnut, and Task Chairs + Filing Cab
  const woDefs = [
    { orderNumber: 'DEMO-2026-001', lines: [
      { model: 'DESK-01', color: 'WAL', qty: 5 },
      { model: 'CHAR-02', color: 'BLK', qty: 10 },
    ]},
    { orderNumber: 'DEMO-2026-002', lines: [
      { model: 'CAB-01',  color: 'WHT', qty: 8 },
      { model: 'DESK-01', color: 'OAK', qty: 3 },
    ]},
  ];

  for (const def of woDefs) {
    const [woRow] = await db.select().from(workOrder).where(eq(workOrder.orderNumber, def.orderNumber));
    const wo = await upsert(`Work Order ${def.orderNumber}`, woRow, async () => {
      const [r] = await db.insert(workOrder).values({
        orderNumber: def.orderNumber, status: 'DRAFT',
      }).returning();
      return r;
    });

    // Insert lines
    for (const lineDef of def.lines) {
      const [lineRow] = await db
        .select()
        .from(workOrderLine)
        .where(and(eq(workOrderLine.workOrderId, wo.id), eq(workOrderLine.modelId, models[lineDef.model].id)));
      await upsert(`  Line ${def.orderNumber} → ${lineDef.model}×${lineDef.qty}`, lineRow, async () => {
        const [r] = await db.insert(workOrderLine).values({
          workOrderId: wo.id, modelId: models[lineDef.model].id,
          colorId: colors[lineDef.color].id, quantity: lineDef.qty,
        }).returning();
        return r;
      });
    }

    // Release if still DRAFT
    const [check] = await db.select({ status: workOrder.status }).from(workOrder).where(eq(workOrder.id, wo.id));
    if (check.status === 'DRAFT') {
      await releaseWorkOrder(wo.id);
      console.log(`  ~ Released ${def.orderNumber}`);
    }
  }

  // ── Simulate some operation events so the tablet feed isn't empty ──
  const openOps = await db
    .select({ id: workOrderOperation.id, status: workOrderOperation.status })
    .from(workOrderOperation)
    .where(eq(workOrderOperation.status, 'QUEUED'))
    .limit(3);

  for (const op of openOps) {
    const [existing] = await db
      .select()
      .from(operationEvent)
      .where(and(eq(operationEvent.operationId, op.id), eq(operationEvent.eventType, 'START')));
    if (!existing) {
      try {
        await applyEvent(op.id, 'START', { operatorId: 'seed', note: 'Demo auto-start' });
        console.log(`  ~ Started operation ${op.id}`);
      } catch { /* already started */ }
    }
  }

  // ── Shift Calendar (next 90 days, Sun-Thu 08:00-16:00) ─────────────────
  function localDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  let shiftCount = 0;
  for (let i = 0; i < 90; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dayOfWeek = d.getDay();
    const dateStr = localDateStr(d);
    const isWorkingDay = dayOfWeek >= 0 && dayOfWeek <= 4; // Sun-Thu
    const [existing] = await db.select().from(shiftCalendar).where(eq(shiftCalendar.date, dateStr));
    if (!existing) {
      await db.insert(shiftCalendar).values({
        date: dateStr,
        startTime: '08:00',
        endTime: '16:00',
        isWorkingDay,
      });
      shiftCount++;
    }
  }
  console.log(`Shift calendar: ${shiftCount} new days added`);

  // ── Run / re-run scheduler ────────────────────────────────────────────
  const cleared = await clearSchedule();
  const schedResult = await runScheduler();
  if (cleared > 0) console.log(`  ~ Cleared ${cleared} existing scheduled times`);
  console.log(`  ~ Scheduled ${schedResult.scheduled} operations`);
  if (schedResult.errors.length > 0) {
    console.log(`  ! Errors: ${schedResult.errors.join(', ')}`);
  }

  // ── Material Categories ────────────────────────────────────────────
  const catData = [
    { code: 'WOD', nameAr: 'خشب',           nameEn: 'Wood' },
    { code: 'MET', nameAr: 'معدن',           nameEn: 'Metal' },
    { code: 'FAB', nameAr: 'قماش',           nameEn: 'Fabric' },
    { code: 'HRD', nameAr: 'معدات',          nameEn: 'Hardware' },
    { code: 'PKG', nameAr: 'تغليف',          nameEn: 'Packaging' },
  ];
  const cats: Record<string, typeof materialCategory.$inferSelect> = {};
  for (const c of catData) {
    const [row] = await db.select().from(materialCategory).where(eq(materialCategory.code, c.code));
    cats[c.code] = await upsert(`Material Category ${c.code}`, row, async () => {
      const [r] = await db.insert(materialCategory).values(c).returning();
      return r;
    });
  }

  // ── Materials ──────────────────────────────────────────────────────
  const matData = [
    { code: 'MDF-18',  nameAr: 'إم دي إف 18مم',    nameEn: 'MDF 18mm',          unit: 'sheet', cat: 'WOD' },
    { code: 'MDF-25',  nameAr: 'إم دي إف 25مم',    nameEn: 'MDF 25mm',          unit: 'sheet', cat: 'WOD' },
    { code: 'PB-18',   nameAr: 'خشب مضغوط 18مم',   nameEn: 'Particle Board 18mm', unit: 'sheet', cat: 'WOD' },
    { code: 'STL-LG',  nameAr: 'أرجل معدنية',       nameEn: 'Steel Legs',        unit: 'pcs',   cat: 'MET' },
    { code: 'STL-FR',  nameAr: 'إطار معدني',        nameEn: 'Steel Frame',       unit: 'pcs',   cat: 'MET' },
    { code: 'FBR-BLK', nameAr: 'قماش أسود',         nameEn: 'Black Fabric',      unit: 'm²',    cat: 'FAB' },
    { code: 'FBR-GRY', nameAr: 'قماش رمادي',        nameEn: 'Gray Fabric',       unit: 'm²',    cat: 'FAB' },
    { code: 'SCR-8',   nameAr: 'براغي 8مم',         nameEn: 'Screws 8mm',        unit: 'pcs',   cat: 'HRD' },
    { code: 'HNG-SM',  nameAr: 'مفصلات صغيرة',      nameEn: 'Hinges Small',      unit: 'pcs',   cat: 'HRD' },
    { code: 'BOX-LG',  nameAr: 'كرتون كبير',        nameEn: 'Large Carton Box',  unit: 'pcs',   cat: 'PKG' },
  ];
  const mats: Record<string, typeof material.$inferSelect> = {};
  for (const m of matData) {
    const [row] = await db.select().from(material).where(eq(material.code, m.code));
    mats[m.code] = await upsert(`Material ${m.code}`, row, async () => {
      const [r] = await db.insert(material).values({
        code: m.code,
        nameAr: m.nameAr,
        nameEn: m.nameEn,
        unit: m.unit,
        categoryId: cats[m.cat].id,
      }).returning();
      return r;
    });
  }

  // ── Stock Transactions ─────────────────────────────────────────────
  const txData = [
    { mat: 'MDF-18', type: 'RECEIPT' as const, qty: 200, ref: 'PO-2026-045' },
    { mat: 'MDF-25', type: 'RECEIPT' as const, qty: 150, ref: 'PO-2026-045' },
    { mat: 'PB-18',  type: 'RECEIPT' as const, qty: 300, ref: 'PO-2026-046' },
    { mat: 'STL-LG', type: 'RECEIPT' as const, qty: 500, ref: 'PO-2026-047' },
    { mat: 'STL-FR', type: 'RECEIPT' as const, qty: 200, ref: 'PO-2026-047' },
    { mat: 'FBR-BLK', type: 'RECEIPT' as const, qty: 100, ref: 'PO-2026-048' },
    { mat: 'FBR-GRY', type: 'RECEIPT' as const, qty: 80,  ref: 'PO-2026-048' },
    { mat: 'SCR-8',  type: 'RECEIPT' as const, qty: 2000, ref: 'PO-2026-049' },
    { mat: 'HNG-SM', type: 'RECEIPT' as const, qty: 400,  ref: 'PO-2026-049' },
    { mat: 'BOX-LG', type: 'RECEIPT' as const, qty: 100,  ref: 'PO-2026-050' },
  ];
  for (const t of txData) {
    const [existing] = await db.select()
      .from(stockTransaction)
      .where(and(
        eq(stockTransaction.materialId, mats[t.mat].id),
        eq(stockTransaction.reference, t.ref),
      ))
      .limit(1);
    if (!existing) {
      await db.insert(stockTransaction).values({
        materialId: mats[t.mat].id,
        type: t.type,
        quantity: t.qty,
        reference: t.ref,
        createdBy: 'seed',
      });
      console.log(`  + Stock tx ${t.type} ${t.mat} x${t.qty}`);
    } else {
      console.log(`  · Stock tx ${t.type} ${t.mat} x${t.qty}`);
    }
  }

  console.log('\n── Seed complete ──');
  console.log('Users:      admin/admin123  operator/op123  viewer/view123');
  console.log('Tablet:     http://localhost:3000/tablet');
  console.log('Orders:     http://localhost:3000/orders');
  console.log('Admin:      http://localhost:3000/admin');
}

main().catch((e) => { console.error(e); process.exit(1); });
