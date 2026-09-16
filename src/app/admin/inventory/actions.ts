'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { stockTransaction } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { dbErrorMessage } from '@/lib/db-errors';

export async function recordReceipt(
  _prev: unknown,
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  const session = await requireRole('DATA_ENTRY');

  const materialId = Number(formData.get('materialId'));
  const quantity = Number(formData.get('quantity'));
  const reference = (formData.get('reference') as string) ?? '';
  const note = (formData.get('note') as string) ?? '';

  if (!materialId) return { error: 'Material is required / المادة مطلوبة' };
  if (!(Number.isFinite(quantity) && quantity > 0)) {
    return { error: 'Quantity must be positive / الكمية يجب أن تكون موجبة' };
  }

  try {
    await db.insert(stockTransaction).values({
      materialId,
      type: 'RECEIPT',
      quantity,
      reference: reference || null,
      note: note || null,
      workOrderId: null,
      createdBy: session.displayName,
    });
    revalidatePath('/admin/inventory');
    return { success: true };
  } catch (e: unknown) {
    const msg = dbErrorMessage(e);
    return { error: msg };
  }
}

export async function recordIssue(
  _prev: unknown,
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  const session = await requireRole('DATA_ENTRY');

  const materialId = Number(formData.get('materialId'));
  const quantity = Number(formData.get('quantity'));
  const workOrderId = formData.get('workOrderId') ? Number(formData.get('workOrderId')) : null;
  const note = (formData.get('note') as string) ?? '';

  if (!materialId) return { error: 'Material is required / المادة مطلوبة' };
  if (!(Number.isFinite(quantity) && quantity > 0)) {
    return { error: 'Quantity must be positive / الكمية يجب أن تكون موجبة' };
  }

  try {
    await db.insert(stockTransaction).values({
      materialId,
      type: 'ISSUE',
      quantity: -quantity,
      reference: workOrderId ? `WO-${workOrderId}` : null,
      note: note || null,
      workOrderId,
      createdBy: session.displayName,
    });
    revalidatePath('/admin/inventory');
    return { success: true };
  } catch (e: unknown) {
    const msg = dbErrorMessage(e);
    return { error: msg };
  }
}

export async function recordAdjustment(
  _prev: unknown,
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  const session = await requireRole('DATA_ENTRY');

  const materialId = Number(formData.get('materialId'));
  const quantity = Number(formData.get('quantity'));
  const note = (formData.get('note') as string) ?? '';

  if (!materialId) return { error: 'Material is required / المادة مطلوبة' };
  if (!Number.isFinite(quantity) || quantity === 0) {
    return { error: 'Quantity is required / الكمية مطلوبة' };
  }

  try {
    await db.insert(stockTransaction).values({
      materialId,
      type: 'ADJUSTMENT',
      quantity,
      reference: null,
      note: note || null,
      workOrderId: null,
      createdBy: session.displayName,
    });
    revalidatePath('/admin/inventory');
    return { success: true };
  } catch (e: unknown) {
    const msg = dbErrorMessage(e);
    return { error: msg };
  }
}
