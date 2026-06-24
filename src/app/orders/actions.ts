'use server';
import { and, desc, eq, like } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db/db';
import { workOrder } from '@/db/schema';

export async function createWorkOrder() {
  const year = new Date().getFullYear();
  const pattern = `PO-${year}-%`;

  let newId: number;

  const [inserted] = await db.transaction(async (tx) => {
    const [last] = await tx
      .select({ orderNumber: workOrder.orderNumber })
      .from(workOrder)
      .where(like(workOrder.orderNumber, pattern))
      .orderBy(desc(workOrder.id))
      .limit(1);

    const lastN = last ? parseInt(last.orderNumber.split('-')[2], 10) : 0;
    const nextN = String(lastN + 1).padStart(3, '0');
    const orderNumber = `PO-${year}-${nextN}`;

    return tx
      .insert(workOrder)
      .values({ orderNumber, status: 'DRAFT' })
      .returning({ id: workOrder.id });
  });

  newId = inserted.id;
  redirect(`/orders/${newId}`);
}

export async function deleteWorkOrder(formData: FormData) {
  const id = Number(formData.get('id'));
  await db.delete(workOrder).where(and(eq(workOrder.id, id), eq(workOrder.status, 'DRAFT')));
  revalidatePath('/orders');
}
