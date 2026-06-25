import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { qualityDefect, workOrderOperation, workOrderLine, workOrder, model, workCenter } from '@/db/schema';
import type { QualityDefectCategory } from '@/db/schema';

const CATEGORY_LABEL: Record<QualityDefectCategory, string> = {
  DIMENSIONAL: 'أبعاد / Dimensional',
  SURFACE:     'سطح / Surface + Paint',
  ASSEMBLY:    'تجميع / Assembly',
  OTHER:       'أخرى / Other',
};

const CATEGORY_COLOR: Record<QualityDefectCategory, string> = {
  DIMENSIONAL: 'bg-red-900 text-red-300',
  SURFACE:     'bg-orange-900 text-orange-300',
  ASSEMBLY:    'bg-yellow-900 text-yellow-300',
  OTHER:       'bg-gray-700 text-gray-300',
};

export default async function QualityPage() {
  const defects = await db
    .select({
      id: qualityDefect.id,
      category: qualityDefect.category,
      reportedBy: qualityDefect.reportedBy,
      createdAt: qualityDefect.createdAt,
      orderNumber: workOrder.orderNumber,
      modelNameAr: model.nameAr,
      modelCode: model.code,
      workCenterNameAr: workCenter.nameAr,
      workCenterCode: workCenter.code,
    })
    .from(qualityDefect)
    .innerJoin(workOrderOperation, eq(qualityDefect.operationId, workOrderOperation.id))
    .innerJoin(workOrderLine, eq(workOrderOperation.workOrderLineId, workOrderLine.id))
    .innerJoin(workOrder, eq(workOrderLine.workOrderId, workOrder.id))
    .innerJoin(model, eq(workOrderLine.modelId, model.id))
    .innerJoin(workCenter, eq(workOrderOperation.workCenterId, workCenter.id))
    .orderBy(desc(qualityDefect.createdAt));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Quality Defects / عيوب الجودة</h1>

      {defects.length === 0 ? (
        <p className="text-gray-500">No defects recorded.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-left">
              <th className="pb-2 pr-4">Order</th>
              <th className="pb-2 pr-4">Model</th>
              <th className="pb-2 pr-4">Work Center</th>
              <th className="pb-2 pr-4">Defect Type</th>
              <th className="pb-2 pr-4">Reporter</th>
              <th className="pb-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {defects.map((row) => (
              <tr key={row.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                <td className="py-3 pr-4 font-mono text-sm">{row.orderNumber}</td>
                <td className="py-3 pr-4">
                  <div className="font-medium">{row.modelNameAr}</div>
                  <div className="text-gray-500 text-xs">{row.modelCode}</div>
                </td>
                <td className="py-3 pr-4">
                  <div>{row.workCenterNameAr}</div>
                  <div className="text-gray-500 text-xs">{row.workCenterCode}</div>
                </td>
                <td className="py-3 pr-4">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLOR[row.category]}`}>
                    {CATEGORY_LABEL[row.category]}
                  </span>
                </td>
                <td className="py-3 pr-4 text-gray-400">{row.reportedBy}</td>
                <td className="py-3 text-gray-400 font-mono text-xs whitespace-nowrap">
                  {row.createdAt.slice(0, 16).replace('T', ' ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
