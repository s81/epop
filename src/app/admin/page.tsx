import { and, asc, count, desc, eq, inArray, like, sql, sum } from 'drizzle-orm';
import { db } from '@/db/db';
import {
  maintenanceRequest,
  operationEvent,
  productionTarget,
  qualityDefect,
  workCenter,
  workOrder,
  workOrderOperation,
} from '@/db/schema';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  QUEUED:      'bg-gray-400',
  IN_PROGRESS: 'bg-green-500',
  PAUSED:      'bg-yellow-400',
  PENDING_QC:  'bg-purple-400',
  COMPLETED:   'bg-blue-500',
  REJECTED:    'bg-red-500',
};

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default async function DashboardPage() {
  const today = todayStr();

  const [ordersByStatus, opsByStatus, wcLoad, recentEvents, openMaint, defectCount, todayActual, todayTarget] = await Promise.all([
    db.select({ status: workOrder.status, count: count() }).from(workOrder).groupBy(workOrder.status),
    db.select({ status: workOrderOperation.status, count: count() }).from(workOrderOperation).groupBy(workOrderOperation.status),
    db.select({
      code: workCenter.code,
      nameAr: workCenter.nameAr,
      queued: sql<number>`coalesce(sum(case when ${workOrderOperation.status} = 'QUEUED' then 1 else 0 end), 0)`,
      inProgress: sql<number>`coalesce(sum(case when ${workOrderOperation.status} = 'IN_PROGRESS' then 1 else 0 end), 0)`,
    }).from(workCenter)
      .leftJoin(workOrderOperation, eq(workOrderOperation.workCenterId, workCenter.id))
      .groupBy(workCenter.id, workCenter.code, workCenter.nameAr)
      .orderBy(asc(workCenter.code)),
    db.select({
      id: operationEvent.id,
      eventType: operationEvent.eventType,
      note: operationEvent.note,
      occurredAt: operationEvent.occurredAt,
    }).from(operationEvent).orderBy(desc(operationEvent.occurredAt)).limit(10),
    db.select({ count: count() }).from(maintenanceRequest).where(eq(maintenanceRequest.status, 'OPEN')).then(r => r[0] ?? { count: 0 }),
    db.select({ count: count() }).from(qualityDefect).then(r => r[0] ?? { count: 0 }),
    db.select({ count: count() }).from(operationEvent)
      .where(and(
        inArray(operationEvent.eventType, ['FINISH', 'ACCEPT']),
        like(operationEvent.occurredAt, `${today}T%`),
      )).then(r => r[0]?.count ?? 0),
    db.select({ total: sum(productionTarget.targetQuantity) })
      .from(productionTarget)
      .where(eq(productionTarget.date, today))
      .then(r => r[0]?.total ?? null),
  ]);

  const totalOps = opsByStatus.reduce((s, r) => s + r.count, 0);
  const inProgressCount = opsByStatus.find((r) => r.status === 'IN_PROGRESS')?.count ?? 0;
  const maxWcLoad = Math.max(...wcLoad.map((w) => w.queued + w.inProgress), 1);
  const todayRate = todayTarget !== null ? todayActual / Number(todayTarget) : null;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Dashboard / لوحة القيادة</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Work Orders', value: ordersByStatus.reduce((s, r) => s + r.count, 0), color: 'bg-indigo-50 text-indigo-700 border-indigo-200', href: '/orders' },
          { label: 'In Progress', value: inProgressCount, color: 'bg-green-50 text-green-700 border-green-200', href: '/tablet' },
          { label: 'Open Maintenance', value: openMaint.count, color: 'bg-amber-50 text-amber-700 border-amber-200', href: '/admin/maintenance' },
          { label: 'Quality Defects', value: defectCount.count, color: 'bg-red-50 text-red-700 border-red-200', href: '/admin/quality' },
          {
            label: "Today's Achievement",
            value: todayRate !== null ? `${Math.round(todayRate * 100)}%` : '—',
            color: todayRate !== null
              ? todayRate >= 0.8
                ? 'bg-green-50 text-green-700 border-green-200'
                : todayRate >= 0.5
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              : 'bg-gray-50 text-gray-500 border-gray-200',
            href: '/admin/targets',
          },
        ].map(({ label, value, color, href }) => (
          <Link key={label} href={href} className={`rounded-lg border p-4 ${color} hover:shadow-sm transition-shadow`}>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm mt-1">{label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Operations by Status */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Operations by Status / العمليات حسب الحالة</h2>
          <div className="space-y-2">
            {opsByStatus.map((r) => {
              const pct = totalOps ? (r.count / totalOps) * 100 : 0;
              return (
                <div key={r.status}>
                  <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                    <span>{r.status}</span>
                    <span>{r.count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${STATUS_COLORS[r.status] || 'bg-gray-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Work Center Load */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Work Center Load / حمل مراكز العمل</h2>
          <div className="space-y-2.5">
            {wcLoad.map((w) => {
              const total = w.queued + w.inProgress;
              const pct = total / maxWcLoad * 100;
              return (
                <div key={w.code}>
                  <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                    <span className="font-medium">{w.code} — {w.nameAr}</span>
                    <span>{w.queued}Q / {w.inProgress}IP</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 flex">
                    {w.inProgress > 0 && (
                      <div
                        className="h-3 bg-green-500 rounded-l-full transition-all"
                        style={{ width: `${(w.inProgress / maxWcLoad) * 100}%` }}
                      />
                    )}
                    {w.queued > 0 && (
                      <div
                        className={`h-3 bg-gray-400 transition-all ${w.inProgress === 0 ? 'rounded-l-full' : ''}`}
                        style={{ width: `${(w.queued / maxWcLoad) * 100}%` }}
                      />
                    )}
                    {total === 0 && <div className="h-3 bg-gray-100 rounded-full w-full" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity / آخر النشاطات</h2>
        {recentEvents.length === 0 ? (
          <p className="text-xs text-gray-400">No recent events</p>
        ) : (
          <div className="space-y-1.5">
            {recentEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-3 text-xs text-gray-600">
                <span className="font-mono text-gray-400 w-16 flex-shrink-0">
                  {new Date(e.occurredAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  e.eventType === 'START' ? 'bg-green-100 text-green-700' :
                  e.eventType === 'FINISH' ? 'bg-blue-100 text-blue-700' :
                  e.eventType === 'REJECT' ? 'bg-red-100 text-red-700' :
                  e.eventType === 'ACCEPT' ? 'bg-purple-100 text-purple-700' :
                  e.eventType === 'PAUSE' ? 'bg-yellow-100 text-yellow-700' :
                  e.eventType === 'RESUME' ? 'bg-cyan-100 text-cyan-700' :
                  e.eventType === 'RESTART' ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {e.eventType}
                </span>
                {e.note && <span className="text-gray-400 truncate">{e.note}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
