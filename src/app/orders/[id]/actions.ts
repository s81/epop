'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { workOrder, workOrderLine } from '@/db/schema';
import { releaseWorkOrder } from '@/db/operations';
import { requireRole } from '@/lib/auth';

export async function addLine(_prev: unknown, formData: FormData) {
  const workOrderId = Number(formData.get('workOrderId'));
  const modelId = Number(formData.get('modelId'));
  const colorIdRaw = formData.get('colorId');
  const colorId = colorIdRaw && colorIdRaw !== '' ? Number(colorIdRaw) : null;
  const quantity = Math.max(1, Number(formData.get('quantity')) || 1);

  try {
    await requireRole('DATA_ENTRY');
    await db.transaction(async (tx) => {
      const [order] = await tx
        .select({ status: workOrder.status })
        .from(workOrder)
        .where(eq(workOrder.id, workOrderId));

      if (!order || order.status !== 'DRAFT') {
        throw new Error('Cannot modify a released order');
      }

      await tx.insert(workOrderLine).values({ workOrderId, modelId, colorId, quantity });
    });
    revalidatePath(`/orders/${workOrderId}`);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteLine(formData: FormData) {
  await requireRole('DATA_ENTRY');
  const lineId = Number(formData.get('lineId'));
  const workOrderId = Number(formData.get('workOrderId'));

  try {
    await db.transaction(async (tx) => {
      const [order] = await tx
        .select({ status: workOrder.status })
        .from(workOrder)
        .where(eq(workOrder.id, workOrderId));

      if (!order || order.status !== 'DRAFT') return;

      await tx.delete(workOrderLine).where(eq(workOrderLine.id, lineId));
    });
    revalidatePath(`/orders/${workOrderId}`);
  } catch {
    // line may already be gone; revalidate so UI stays consistent
    revalidatePath(`/orders/${workOrderId}`);
  }
}

export async function releaseOrderAction(_prev: unknown, formData: FormData) {
  const id = Number(formData.get('id'));
  try {
    await requireRole('DATA_ENTRY');
    await releaseWorkOrder(id);
    revalidatePath(`/orders/${id}`);
    revalidatePath('/orders');
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
