'use server';
import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { model, workOrder, workOrderLine } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { releaseWorkOrder } from '@/db/operations';

export async function createWorkOrder(_prev: unknown, formData: FormData) {
  try {
    await requireRole('DATA_ENTRY');

    const modelIds = formData.getAll('modelId').map((v) => Number(v));
    const quantities = formData.getAll('quantity').map((v) => Number(v));
    const colorIds = formData.getAll('colorId').map((v) => (v ? Number(v) : null));

    if (modelIds.length === 0) return { error: 'At least one line is required' };

    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;

    const [lastOrder] = await db
      .select({ orderNumber: workOrder.orderNumber })
      .from(workOrder)
      .where(sql`${workOrder.orderNumber} LIKE ${prefix + '%'}`)
      .orderBy(
        sql`CAST(SUBSTR(${workOrder.orderNumber}, LENGTH(${prefix}) + 1) AS INTEGER) DESC`,
      )
      .limit(1);

    const nextSeq = lastOrder
      ? parseInt(lastOrder.orderNumber.slice(prefix.length), 10) + 1
      : 1;

    const orderNumber = `${prefix}${String(nextSeq).padStart(3, '0')}`;

    const [wo] = await db
      .insert(workOrder)
      .values({ orderNumber })
      .returning({ id: workOrder.id });

    await db.insert(workOrderLine).values(
      modelIds.map((modelId, i) => ({
        workOrderId: wo.id,
        modelId,
        quantity: quantities[i],
        colorId: colorIds[i],
      })),
    );

    revalidatePath('/admin/orders');
    return { success: true, id: wo.id };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

export async function releaseWorkOrderAction(formData: FormData) {
  await requireRole('DATA_ENTRY');
  const orderId = Number(formData.get('orderId'));
  await releaseWorkOrder(orderId);
  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
}

export async function deleteWorkOrder(formData: FormData) {
  await requireRole('DATA_ENTRY');
  const id = Number(formData.get('id'));

  const [order] = await db
    .select({ status: workOrder.status })
    .from(workOrder)
    .where(eq(workOrder.id, id));

  if (!order || order.status !== 'DRAFT') {
    throw new Error('Can only delete DRAFT orders');
  }

  await db.delete(workOrder).where(eq(workOrder.id, id));
  revalidatePath('/admin/orders');
}

export async function updateOrderLines(_prev: unknown, formData: FormData) {
  try {
    await requireRole('DATA_ENTRY');

    const orderId = Number(formData.get('orderId'));

    const [order] = await db
      .select({ status: workOrder.status })
      .from(workOrder)
      .where(eq(workOrder.id, orderId));

    if (!order || order.status !== 'DRAFT') {
      return { error: 'Order must be in DRAFT status' };
    }

    const modelIds = formData.getAll('modelId').map((v) => Number(v));
    const quantities = formData.getAll('quantity').map((v) => Number(v));
    const colorIds = formData.getAll('colorId').map((v) => (v ? Number(v) : null));

    if (modelIds.length === 0) {
      return { error: 'At least one line is required' };
    }

    for (let i = 0; i < modelIds.length; i++) {
      if (!modelIds[i]) return { error: 'All models must be selected' };
      if (!quantities[i] || quantities[i] < 1) return { error: 'All quantities must be greater than 0' };
    }

    await db.delete(workOrderLine).where(eq(workOrderLine.workOrderId, orderId));

    await db.insert(workOrderLine).values(
      modelIds.map((modelId, i) => ({
        workOrderId: orderId,
        modelId,
        quantity: quantities[i],
        colorId: colorIds[i],
      })),
    );

    revalidatePath('/admin/orders');
    revalidatePath(`/admin/orders/${orderId}`);
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}
