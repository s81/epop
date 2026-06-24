'use server';
import { revalidatePath } from 'next/cache';
import { applyEvent } from '@/db/operations';
import type { OperationEventType } from '@/db/schema';

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
