import { asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { material, materialCategory, stockTransaction, workOrder } from '@/db/schema';
import { InventoryClient } from './client';
import { recordReceipt, recordIssue, recordAdjustment } from './actions';

export default async function InventoryPage() {
  const materials = await db
    .select({
      id: material.id,
      code: material.code,
      nameAr: material.nameAr,
      nameEn: material.nameEn,
      unit: material.unit,
      categoryId: material.categoryId,
      categoryName: materialCategory.nameEn,
    })
    .from(material)
    .innerJoin(materialCategory, eq(materialCategory.id, material.categoryId))
    .orderBy(asc(material.code));

  const stockLevels = await db
    .select({
      materialId: stockTransaction.materialId,
      stock: sql<number>`coalesce(sum(${stockTransaction.quantity}), 0)`,
    })
    .from(stockTransaction)
    .groupBy(stockTransaction.materialId);

  const stockMap = new Map(stockLevels.map((s) => [s.materialId, s.stock]));

  const materialsWithStock = materials.map((m) => ({
    ...m,
    stock: stockMap.get(m.id) ?? 0,
  }));

  const recentTransactions = await db
    .select({
      id: stockTransaction.id,
      materialId: stockTransaction.materialId,
      type: stockTransaction.type,
      quantity: stockTransaction.quantity,
      reference: stockTransaction.reference,
      note: stockTransaction.note,
      createdBy: stockTransaction.createdBy,
      createdAt: stockTransaction.createdAt,
      materialCode: material.code,
      materialNameEn: material.nameEn,
    })
    .from(stockTransaction)
    .innerJoin(material, eq(material.id, stockTransaction.materialId))
    .orderBy(desc(stockTransaction.createdAt))
    .limit(50);

  const workOrders = await db
    .select({ id: workOrder.id, orderNumber: workOrder.orderNumber })
    .from(workOrder)
    .orderBy(desc(workOrder.createdAt))
    .limit(100);

  return (
    <InventoryClient
      materials={materialsWithStock}
      transactions={recentTransactions}
      workOrders={workOrders}
      onReceipt={recordReceipt}
      onIssue={recordIssue}
      onAdjustment={recordAdjustment}
    />
  );
}
