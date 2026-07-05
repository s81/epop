import { desc, eq, count, asc } from 'drizzle-orm';
import { db } from '@/db/db';
import { maintenanceRequest, qualityDefect, workCenter } from '@/db/schema';
import Link from 'next/link';

async function getOpenMaintenance() {
  const [{ value: cnt }] = await db
    .select({ value: count() })
    .from(maintenanceRequest)
    .where(eq(maintenanceRequest.status, 'OPEN'));

  const latest = await db
    .select({
      id: maintenanceRequest.id,
      category: maintenanceRequest.category,
      workCenterCode: workCenter.code,
    })
    .from(maintenanceRequest)
    .leftJoin(workCenter, eq(maintenanceRequest.workCenterId, workCenter.id))
    .where(eq(maintenanceRequest.status, 'OPEN'))
    .orderBy(desc(maintenanceRequest.createdAt))
    .limit(3);

  return { count: cnt, latest };
}

async function getQualityDefects() {
  const [{ value: cnt }] = await db
    .select({ value: count() })
    .from(qualityDefect);

  return cnt;
}

export default async function NotificationBar() {
  const [openMaint, defectCount] = await Promise.all([
    getOpenMaintenance(),
    getQualityDefects(),
  ]);

  if (openMaint.count === 0 && defectCount === 0) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-8 py-3 flex items-center gap-6 text-sm flex-wrap">
      <span className="text-lg" role="img" aria-label="alert">⚠</span>
      {openMaint.count > 0 && (
        <span>
          Open Maintenance:&nbsp;
          <Link href="/admin/maintenance" className="font-semibold underline hover:text-amber-800">
            {openMaint.count}
          </Link>
          &nbsp;/ الصيانة المفتوحة: {openMaint.count}
          {openMaint.latest.length > 0 && (
            <span className="text-gray-500 ml-2">
              ({openMaint.latest.map(m => `${m.workCenterCode ?? '?'} (${m.category})`).join(', ')})
            </span>
          )}
        </span>
      )}
      {openMaint.count > 0 && defectCount > 0 && <span className="text-gray-300">|</span>}
      {defectCount > 0 && (
        <span>
          Quality Defects:&nbsp;
          <Link href="/admin/quality" className="font-semibold underline hover:text-amber-800">
            {defectCount}
          </Link>
          &nbsp;/ عيوب الجودة: {defectCount}
        </span>
      )}
    </div>
  );
}
