'use client';

import { ExportCsv } from '@/components/admin/ExportCsv';
import type { QualityDefectCategory } from '@/db/schema';

const CATEGORY_LABEL: Record<QualityDefectCategory, string> = {
  DIMENSIONAL: 'أبعاد / Dimensional',
  SURFACE:     'سطح / Surface + Paint',
  ASSEMBLY:    'تجميع / Assembly',
  OTHER:       'أخرى / Other',
};

export function QualityExportButton({ defects }: { defects: Array<{
  id: number;
  operationId: number;
  eventType: string;
  category: QualityDefectCategory;
  reportedBy: string;
  createdAt: string;
  orderNumber: string;
  modelNameAr: string;
  modelCode: string;
  workCenterNameAr: string;
  workCenterCode: string;
}>}) {
  return (
    <ExportCsv
      data={defects.map(d => ({
        id: d.id,
        operationId: d.operationId,
        eventType: d.eventType,
        orderNumber: d.orderNumber,
        model: `${d.modelNameAr} (${d.modelCode})`,
        workCenter: `${d.workCenterNameAr} (${d.workCenterCode})`,
        category: CATEGORY_LABEL[d.category],
        reportedBy: d.reportedBy,
        createdAt: d.createdAt.slice(0, 16).replace('T', ' '),
      }))}
      filename="quality-defects.csv"
      headers={{
        id: 'ID',
        operationId: 'Op ID',
        eventType: 'Event',
        orderNumber: 'Order / رقم الأمر',
        model: 'Model / الموديل',
        workCenter: 'Work Center / مركز العمل',
        category: 'Defect Type / نوع العيب',
        reportedBy: 'Reporter / المبلغ',
        createdAt: 'Time / الوقت',
      }}
    />
  );
}
