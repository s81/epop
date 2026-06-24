import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db/db';
import { color, model, workOrder, workOrderLine } from '@/db/schema';
import { OrderDetailClient } from './client';
import { addLine, deleteLine, releaseOrderAction } from './actions';

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);

  const [order] = await db.select().from(workOrder).where(eq(workOrder.id, id));
  if (!order) notFound();

  const [lines, models, colors] = await Promise.all([
    db
      .select({
        id: workOrderLine.id,
        modelId: workOrderLine.modelId,
        modelCode: model.code,
        modelNameEn: model.nameEn,
        colorId: workOrderLine.colorId,
        colorNameEn: color.nameEn,
        quantity: workOrderLine.quantity,
      })
      .from(workOrderLine)
      .innerJoin(model, eq(model.id, workOrderLine.modelId))
      .leftJoin(color, eq(color.id, workOrderLine.colorId))
      .where(eq(workOrderLine.workOrderId, id))
      .orderBy(asc(workOrderLine.id)),

    db
      .select({ id: model.id, code: model.code, nameEn: model.nameEn })
      .from(model)
      .orderBy(asc(model.code)),

    db
      .select({ id: color.id, code: color.code, nameEn: color.nameEn })
      .from(color)
      .orderBy(asc(color.code)),
  ]);

  return (
    <OrderDetailClient
      order={order}
      lines={lines}
      models={models}
      colors={colors}
      onAddLine={addLine}
      onDeleteLine={deleteLine}
      onRelease={releaseOrderAction}
    />
  );
}
