import { and, asc, count, desc, eq, inArray, isNotNull, like, sql, sum } from 'drizzle-orm';
import { db } from '@/db/db';
import {
  operationEvent,
  productionTarget,
  qualityDefect,
  workCenter,
  workOrder,
  workOrderLine,
  workOrderOperation,
} from '@/db/schema';
import type { QualityDefectCategory } from '@/db/schema';
import { getLaborHours } from '@/db/labor';
import { ReportsExportButton } from './reports-export';

const CATEGORY_LABEL: Record<QualityDefectCategory, string> = {
  DIMENSIONAL: 'أبعاد / Dimensional',
  SURFACE:     'سطح / Surface + Paint',
  ASSEMBLY:    'تجميع / Assembly',
  OTHER:       'أخرى / Other',
};

const MONTH_NAMES: Record<string, string> = {
  '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'إبريل',
  '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
  '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر',
};

function formatMonth(ym: string): string {
  const parts = ym.split('-');
  if (parts.length !== 2) return ym;
  const m = MONTH_NAMES[parts[1]] || parts[1];
  return `${ym} / ${m} ${parts[0]}`;
}

export default async function ReportsPage() {
  const completedMonth = sql<string>`strftime('%Y-%m', ${workOrderOperation.completedAt})`;

  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const firstOfMonth = `${currentMonth}-01`;
  const lastOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const lastOfMonthStr = `${currentMonth}-${String(lastOfMonth).padStart(2, '0')}`;
  const laborRecords = await getLaborHours(firstOfMonth, lastOfMonthStr);
  const laborByOp = new Map<string, { hours: number; events: number; minutes: number }>();
  for (const r of laborRecords) {
    if (!laborByOp.has(r.operatorId)) laborByOp.set(r.operatorId, { hours: 0, events: 0, minutes: 0 });
    const entry = laborByOp.get(r.operatorId)!;
    entry.minutes += r.minutes;
    entry.events += r.events;
  }
  for (const [, v] of laborByOp) v.hours = Math.round((v.minutes / 60) * 10) / 10;

  const [productionSummary, defectAnalysis, operatorActivity, orderCompletion, targetAchievement] = await Promise.all([
    db.select({
      code: workCenter.code,
      nameAr: workCenter.nameAr,
      completed: count(),
      month: completedMonth,
    }).from(workOrderOperation)
      .innerJoin(workCenter, eq(workOrderOperation.workCenterId, workCenter.id))
      .where(and(
        eq(workOrderOperation.status, 'COMPLETED'),
        isNotNull(workOrderOperation.completedAt),
      ))
      .groupBy(workCenter.id, workCenter.code, workCenter.nameAr, completedMonth)
      .orderBy(desc(completedMonth), asc(workCenter.code)),

    db.select({
      category: qualityDefect.category,
      workCenterCode: workCenter.code,
      workCenterNameAr: workCenter.nameAr,
      count: count(),
    }).from(qualityDefect)
      .innerJoin(workOrderOperation, eq(qualityDefect.operationId, workOrderOperation.id))
      .innerJoin(workCenter, eq(workOrderOperation.workCenterId, workCenter.id))
      .groupBy(qualityDefect.category, workCenter.id, workCenter.code, workCenter.nameAr)
      .orderBy(asc(qualityDefect.category), asc(workCenter.code)),

    db.select({
      operatorId: operationEvent.operatorId,
      starts: sql<number>`coalesce(sum(case when ${operationEvent.eventType} = 'START' then 1 else 0 end), 0)`,
      finishes: sql<number>`coalesce(sum(case when ${operationEvent.eventType} = 'FINISH' then 1 else 0 end), 0)`,
      rejects: sql<number>`coalesce(sum(case when ${operationEvent.eventType} = 'REJECT' then 1 else 0 end), 0)`,
      total: count(),
    }).from(operationEvent)
      .where(isNotNull(operationEvent.operatorId))
      .groupBy(operationEvent.operatorId)
      .orderBy(desc(count())),

    db.select({
      id: workOrder.id,
      orderNumber: workOrder.orderNumber,
      lineCount: sql<number>`count(DISTINCT ${workOrderLine.id})`,
      totalOps: count(workOrderOperation.id),
      completedOps: sql<number>`coalesce(sum(case when ${workOrderOperation.status} = 'COMPLETED' then 1 else 0 end), 0)`,
    }).from(workOrder)
      .innerJoin(workOrderLine, eq(workOrderLine.workOrderId, workOrder.id))
      .innerJoin(workOrderOperation, eq(workOrderOperation.workOrderLineId, workOrderLine.id))
      .where(eq(workOrder.status, 'COMPLETED'))
      .groupBy(workOrder.id, workOrder.orderNumber)
      .orderBy(desc(workOrder.completedAt)),

    (async () => {
      const targets = await db.select({
        workCenterId: productionTarget.workCenterId,
        code: workCenter.code,
        nameAr: workCenter.nameAr,
        targetQty: sum(productionTarget.targetQuantity),
      }).from(productionTarget)
        .innerJoin(workCenter, eq(productionTarget.workCenterId, workCenter.id))
        .where(like(productionTarget.date, `${currentMonth}-%`))
        .groupBy(productionTarget.workCenterId, workCenter.code, workCenter.nameAr)
        .orderBy(asc(workCenter.code));

      if (targets.length === 0) return [];

      const actuals = await db.select({
        workCenterId: workOrderOperation.workCenterId,
        actualQty: count(),
      }).from(operationEvent)
        .innerJoin(workOrderOperation, eq(operationEvent.operationId, workOrderOperation.id))
        .where(and(
          inArray(operationEvent.eventType, ['FINISH', 'ACCEPT']),
          like(operationEvent.occurredAt, `${currentMonth}%`),
        ))
        .groupBy(workOrderOperation.workCenterId);

      const actualMap = new Map(actuals.map(a => [a.workCenterId, a.actualQty]));

      return targets.map(t => ({
        ...t,
        targetQty: Number(t.targetQty),
        actualQty: actualMap.get(t.workCenterId) ?? 0,
      }));
    })(),
  ]);

  const prodTotal = productionSummary.reduce((s, r) => s + r.completed, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Reports / التقارير</h1>
        <ReportsExportButton data={{
          productionSummary,
          defectAnalysis,
          operatorActivity,
          orderCompletion,
        }} />
      </div>

      {/* Section 1: Production Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Production Summary / ملخص الإنتاج</h2>
        {productionSummary.length === 0 ? (
          <p className="text-sm text-gray-400">No data / لا توجد بيانات</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Work Center / مركز العمل</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Month / الشهر</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Completed / المنجز</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {productionSummary.map((r, i) => (
                  <tr key={`${r.code}-${r.month}-${i}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-800">
                      <span className="font-medium">{r.code}</span>
                      <span className="text-gray-500 ml-1">— {r.nameAr}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatMonth(r.month)}</td>
                    <td className="px-4 py-3 text-gray-800 font-mono">{r.completed}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan={2} className="px-4 py-3 text-gray-700 text-left">Total / المجموع</td>
                  <td className="px-4 py-3 text-gray-800 font-mono">{prodTotal}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Defect Analysis */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Defect Analysis / تحليل العيوب</h2>
        {defectAnalysis.length === 0 ? (
          <p className="text-sm text-gray-400">No data / لا توجد بيانات</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category / الفئة</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Work Center / مركز العمل</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Count / العدد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {defectAnalysis.map((r, i) => (
                  <tr key={`${r.category}-${r.workCenterCode}-${i}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-800">{CATEGORY_LABEL[r.category]}</td>
                    <td className="px-4 py-3 text-gray-600">{r.workCenterCode} — {r.workCenterNameAr}</td>
                    <td className="px-4 py-3 text-gray-800 font-mono">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3: Operator Activity (hours + counts) */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Operator Activity / نشاط المشغلين</h2>
        {operatorActivity.length === 0 && laborByOp.size === 0 ? (
          <p className="text-sm text-gray-400">No data / لا توجد بيانات</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Operator ID / معرف المشغل</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Hours / الساعات</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sessions / الجلسات</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Starts / بدء</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Finishes / إنهاء</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Events / إجمالي الأحداث</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {operatorActivity.filter(r => r.operatorId).map((r) => {
                  const labor = laborByOp.get(r.operatorId!);
                  return (
                    <tr key={r.operatorId!} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-800 font-mono">{r.operatorId}</td>
                      <td className="px-4 py-3 text-gray-800 font-mono font-medium">{labor ? `${labor.hours}h` : '—'}</td>
                      <td className="px-4 py-3 text-gray-800 font-mono">{labor?.events ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-800 font-mono">{r.starts}</td>
                      <td className="px-4 py-3 text-gray-800 font-mono">{r.finishes}</td>
                      <td className="px-4 py-3 text-gray-800 font-mono">{r.total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 4: Order Completion */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Order Completion / إنجاز الطلبات</h2>
        {orderCompletion.length === 0 ? (
          <p className="text-sm text-gray-400">No data / لا توجد بيانات</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Order / الأمر</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Lines / البنود</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Ops / إجمالي العمليات</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Completed / المنجز</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Rate / النسبة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orderCompletion.map((r) => {
                  const rate = r.totalOps > 0 ? Math.round((r.completedOps / r.totalOps) * 100) : 0;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-800 font-mono">{r.orderNumber}</td>
                      <td className="px-4 py-3 text-gray-800 font-mono">{r.lineCount}</td>
                      <td className="px-4 py-3 text-gray-800 font-mono">{r.totalOps}</td>
                      <td className="px-4 py-3 text-gray-800 font-mono">{r.completedOps}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                rate === 100 ? 'bg-green-500' : rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-gray-600">{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 5: Target Achievement */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Target Achievement / تحقيق الأهداف</h2>
        {targetAchievement.length === 0 ? (
          <p className="text-sm text-gray-400">No targets set for this month / لا توجد أهداف لهذا الشهر</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Work Center / مركز العمل</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Month / الشهر</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Target Qty / الكمية المستهدفة</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actual Qty / الكمية الفعلية</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Achievement / الإنجاز</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {targetAchievement.map((r) => {
                  const rate = r.targetQty > 0 ? Math.round((r.actualQty / r.targetQty) * 100) : 0;
                  return (
                    <tr key={r.workCenterId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-800">
                        <span className="font-medium">{r.code}</span>
                        <span className="text-gray-500 ml-1">— {r.nameAr}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatMonth(currentMonth)}</td>
                      <td className="px-4 py-3 text-gray-800 font-mono">{r.targetQty}</td>
                      <td className="px-4 py-3 text-gray-800 font-mono">{r.actualQty}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                rate >= 80 ? 'bg-green-500' : rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(rate, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-gray-600">{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
