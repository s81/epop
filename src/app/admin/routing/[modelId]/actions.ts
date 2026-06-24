'use server';
import { asc, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { routingStep } from '@/db/schema';

export async function saveStep(_prev: unknown, formData: FormData) {
  const id = formData.get('id');
  const modelId = Number(formData.get('modelId'));
  const workCenterId = Number(formData.get('workCenterId'));
  const manTimeMinutes = parseFloat(formData.get('manTimeMinutes') as string) || 0;
  const machineTimeMinutes = parseFloat(formData.get('machineTimeMinutes') as string) || 0;
  const setupTimeMinutes = parseFloat(formData.get('setupTimeMinutes') as string) || 0;
  const mco = (formData.get('mco') as string)?.trim() || null;

  try {
    if (id) {
      await db
        .update(routingStep)
        .set({ workCenterId, manTimeMinutes, machineTimeMinutes, setupTimeMinutes, mco })
        .where(eq(routingStep.id, Number(id)));
    } else {
      const [last] = await db
        .select({ sequence: routingStep.sequence })
        .from(routingStep)
        .where(eq(routingStep.modelId, modelId))
        .orderBy(desc(routingStep.sequence))
        .limit(1);
      const nextSeq = (last?.sequence ?? 0) + 10;

      await db.insert(routingStep).values({
        modelId,
        workCenterId,
        sequence: nextSeq,
        manTimeMinutes,
        machineTimeMinutes,
        setupTimeMinutes,
        mco,
      });
    }
    revalidatePath(`/admin/routing/${modelId}`);
    revalidatePath('/admin/routing');
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

export async function deleteStep(formData: FormData) {
  const id = Number(formData.get('id'));
  const modelId = Number(formData.get('modelId'));
  await db.delete(routingStep).where(eq(routingStep.id, id));
  revalidatePath(`/admin/routing/${modelId}`);
  revalidatePath('/admin/routing');
}

export async function moveStep(formData: FormData) {
  const id = Number(formData.get('id'));
  const direction = formData.get('direction') as 'up' | 'down';

  const [current] = await db
    .select({ id: routingStep.id, sequence: routingStep.sequence, modelId: routingStep.modelId })
    .from(routingStep)
    .where(eq(routingStep.id, id));

  if (!current) return;

  const allSteps = await db
    .select({ id: routingStep.id, sequence: routingStep.sequence })
    .from(routingStep)
    .where(eq(routingStep.modelId, current.modelId))
    .orderBy(asc(routingStep.sequence));

  const idx = allSteps.findIndex((s) => s.id === id);
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= allSteps.length) return;

  const target = allSteps[targetIdx];

  await db.transaction(async (tx) => {
    await tx.update(routingStep).set({ sequence: target.sequence }).where(eq(routingStep.id, current.id));
    await tx.update(routingStep).set({ sequence: current.sequence }).where(eq(routingStep.id, target.id));
  });

  revalidatePath(`/admin/routing/${current.modelId}`);
}
