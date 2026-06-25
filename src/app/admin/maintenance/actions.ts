'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { maintenanceRequest } from '@/db/schema';

export async function resolveMaintenanceAction(id: number): Promise<void> {
  await db
    .update(maintenanceRequest)
    .set({ status: 'RESOLVED', resolvedAt: new Date().toISOString() })
    .where(eq(maintenanceRequest.id, id));
  revalidatePath('/admin/maintenance');
}
