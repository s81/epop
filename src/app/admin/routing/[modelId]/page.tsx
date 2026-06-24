import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db/db';
import { model, routingStep, workCenter } from '@/db/schema';
import { RoutingClient } from './client';
import { deleteStep, moveStep } from './actions';

export default async function ModelRoutingPage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  const { modelId: modelIdStr } = await params;
  const modelId = Number(modelIdStr);

  const [mdl] = await db.select().from(model).where(eq(model.id, modelId));
  if (!mdl) notFound();

  const [steps, workCenters] = await Promise.all([
    db
      .select({
        id: routingStep.id,
        sequence: routingStep.sequence,
        workCenterId: routingStep.workCenterId,
        workCenterCode: workCenter.code,
        workCenterNameEn: workCenter.nameEn,
        manTimeMinutes: routingStep.manTimeMinutes,
        machineTimeMinutes: routingStep.machineTimeMinutes,
        setupTimeMinutes: routingStep.setupTimeMinutes,
        mco: routingStep.mco,
      })
      .from(routingStep)
      .innerJoin(workCenter, eq(workCenter.id, routingStep.workCenterId))
      .where(eq(routingStep.modelId, modelId))
      .orderBy(asc(routingStep.sequence)),

    db
      .select({ id: workCenter.id, code: workCenter.code, nameEn: workCenter.nameEn })
      .from(workCenter)
      .orderBy(asc(workCenter.code)),
  ]);

  return (
    <RoutingClient
      modelId={modelId}
      modelCode={mdl.code}
      modelNameEn={mdl.nameEn}
      steps={steps}
      workCenters={workCenters}
      onMove={moveStep}
      onDelete={deleteStep}
    />
  );
}
