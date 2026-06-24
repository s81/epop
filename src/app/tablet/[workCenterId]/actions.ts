'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { maintenanceRequest, qualityDefect } from '@/db/schema';
import { applyEvent } from '@/db/operations';
import type { MaintenanceCategory, OperationEventType, QualityDefectCategory } from '@/db/schema';

export async function applyEventAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | null> {
  const operationId = Number(formData.get('operationId'));
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
  const workCenterId = Number(formData.get('workCenterId'));
  const operationIdRaw = formData.get('operationId');
  const operationId = operationIdRaw ? Number(operationIdRaw) : null;
  const category = formData.get('category') as MaintenanceCategory;
  const note = (formData.get('note') as string | null) || null;
  const reportedBy = String(formData.get('operatorId') ?? '').trim() || 'unknown';

  try {
    await db.insert(maintenanceRequest).values({
      workCenterId,
      operationId,
      category,
      note,
      reportedBy,
    });
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function rejectWithDefectAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | null> {
  const operationId = Number(formData.get('operationId'));
  const defectCategory = formData.get('defectCategory') as QualityDefectCategory;
  const workCenterId = formData.get('workCenterId') as string;
  const operatorIdRaw = String(formData.get('operatorId') ?? '').trim();
  const operatorId = operatorIdRaw || undefined;
  const reportedBy = operatorId ?? 'unknown';

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
