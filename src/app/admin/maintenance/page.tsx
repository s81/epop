import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { maintenanceRequest, workCenter } from '@/db/schema';
import { MaintenanceClient } from './client';
import { resolveMaintenanceAction } from './actions';

export default async function MaintenancePage() {
  const requests = await db
    .select({
      id: maintenanceRequest.id,
      workCenterNameAr: workCenter.nameAr,
      workCenterCode: workCenter.code,
      category: maintenanceRequest.category,
      note: maintenanceRequest.note,
      reportedBy: maintenanceRequest.reportedBy,
      status: maintenanceRequest.status,
      createdAt: maintenanceRequest.createdAt,
    })
    .from(maintenanceRequest)
    .innerJoin(workCenter, eq(maintenanceRequest.workCenterId, workCenter.id))
    .orderBy(desc(maintenanceRequest.createdAt));

  return <MaintenanceClient data={requests} onResolve={resolveMaintenanceAction} />;
}
