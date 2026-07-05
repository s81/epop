import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { maintenanceRequest, workCenter } from '@/db/schema';
import { MaintenanceClient } from './client';
import { resolveMaintenanceAction } from './actions';

const PAGE_SIZE = 50;

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const baseQuery = db
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
    .innerJoin(workCenter, eq(maintenanceRequest.workCenterId, workCenter.id));

  const [requests, countResult] = await Promise.all([
    baseQuery.orderBy(desc(maintenanceRequest.createdAt)).limit(PAGE_SIZE).offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(maintenanceRequest)
      .innerJoin(workCenter, eq(maintenanceRequest.workCenterId, workCenter.id)),
  ]);

  const totalCount = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <MaintenanceClient
      data={requests}
      onResolve={resolveMaintenanceAction}
      currentPage={page}
      totalPages={totalPages}
    />
  );
}
