'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { workOrder, workOrderLine } from '@/db/schema';
import { releaseWorkOrder } from '@/db/operations';

export async function addLine(_prev: unknown, formData: FormData) {
  const workOrderId = Number(formData.get('workOrderId'));
  const modelId = Number(formData.get('modelId'));
  const colorIdRaw = formData.get('colorId');
  const colorId = colorIdRaw && colorIdRaw !== '' ? Number(colorIdRaw) : null;
  const quantity = Math.max(1, Number(formData.get('quantity')) || 1);

  try {
    const [order] = await db
      .select({ status: workOrder.status })
      .from(workOrder)
      .where(eq(workOrder.id, workOrderId));

    if (!order || order.status !== 'DRAFT') {
      return { error: 'Cannot modify a released order' };
    }

    await db.insert(workOrderLine).values({ workOrderId, modelId, colorId, quantity });
    revalidatePath(`/orders/${workOrderId}`);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteLine(formData: FormData) {
  const lineId = Number(formData.get('lineId'));
  const workOrderId = Number(formData.get('workOrderId'));

  const [order] = await db
    .select({ status: workOrder.status })
    .from(workOrder)
    .where(eq(workOrder.id, workOrderId));

  if (!order || order.status !== 'DRAFT') return;

  await db.delete(workOrderLine).where(eq(workOrderLine.id, lineId));
  revalidatePath(`/orders/${workOrderId}`);
}

export async function releaseOrderAction(_prev: unknown, formData: FormData) {
  const id = Number(formData.get('id'));
  try {
    await releaseWorkOrder(id);
    revalidatePath(`/orders/${id}`);
    revalidatePath('/orders');
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
