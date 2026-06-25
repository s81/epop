'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import {
  maintenanceRequest,
  qualityDefect,
  workOrderOperation,
  MAINTENANCE_CATEGORIES,
  QUALITY_DEFECT_CATEGORIES,
} from '@/db/schema';
import { applyEvent } from '@/db/operations';
import type { MaintenanceCategory, OperationEventType, QualityDefectCategory } from '@/db/schema';

export async function applyEventAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | null> {
  const operationId = Number(formData.get('operationId'));
  if (!Number.isInteger(operationId) || operationId <= 0) return { error: 'Invalid operationId' };
  const eventType = formData.get('eventType') as OperationEventType;
  const workCenterId = formData.get('workCenterId') as string;
  const operatorIdRaw = String(formData.get('operatorId') ?? '').trim();
  const operatorId = operatorIdRaw || undefined;

  try {
    await applyEvent(operationId, eventType, { operatorId });
    revalidatePath(`/tablet/${workCenterId}`);
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function reportMaintenanceAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | null> {
  try {
    const workCenterId = Number(formData.get('workCenterId'));
    const operationIdRaw = formData.get('operationId');
    const operationId = operationIdRaw ? Number(operationIdRaw) : null;
    const category = formData.get('category') as MaintenanceCategory;
    if (!MAINTENANCE_CATEGORIES.includes(category)) return { error: 'Invalid category' };
    const note = (formData.get('note') as string | null) || null;
    const reportedBy = String(formData.get('operatorId') ?? '').trim() || 'unknown';

    if (operationId !== null) {
      const [op] = await db
        .select({ wcId: workOrderOperation.workCenterId })
        .from(workOrderOperation)
        .where(eq(workOrderOperation.id, operationId));
      if (!op || op.wcId !== workCenterId) return { error: 'Operation does not belong to this work center' };
    }

    await db.insert(maintenanceRequest).values({
      workCenterId,
      operationId,
      category,
      note,
      reportedBy,
    });
    revalidatePath(`/tablet/${workCenterId}`);
    return null;
  } catch (e) {
    console.error('reportMaintenanceAction error:', e);
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function rejectWithDefectAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | null> {
  const operationId = Number(formData.get('operationId'));
  if (!Number.isInteger(operationId) || operationId <= 0) return { error: 'Invalid operationId' };
  const defectCategory = formData.get('defectCategory') as QualityDefectCategory;
  if (!QUALITY_DEFECT_CATEGORIES.includes(defectCategory)) return { error: 'Invalid defect category' };
  const workCenterId = formData.get('workCenterId') as string;
  const operatorIdRaw = String(formData.get('operatorId') ?? '').trim();
  const operatorId = operatorIdRaw || undefined;
  const reportedBy = operatorId ?? 'unknown';

  const [op] = await db
    .select({ wcId: workOrderOperation.workCenterId })
    .from(workOrderOperation)
    .where(eq(workOrderOperation.id, operationId));
  if (!op || op.wcId !== Number(workCenterId)) return { error: 'Operation does not belong to this work center' };

  try {
    const { eventId } = await applyEvent(operationId, 'REJECT', { operatorId });
    try {
      await db.insert(qualityDefect).values({
        operationId,
        operationEventId: eventId,
        category: defectCategory,
        reportedBy,
      });
    } catch (defectErr) {
      console.error('quality_defect insert failed after REJECT:', defectErr);
    }
    revalidatePath(`/tablet/${workCenterId}`);
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
