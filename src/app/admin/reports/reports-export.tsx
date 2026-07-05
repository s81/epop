'use client';

import { ExportCsv } from '@/components/admin/ExportCsv';
import type { QualityDefectCategory } from '@/db/schema';

const CATEGORY_LABEL: Record<QualityDefectCategory, string> = {
  DIMENSIONAL: 'أبعاد / Dimensional',
  SURFACE:     'سطح / Surface + Paint',
  ASSEMBLY:    'تجميع / Assembly',
  OTHER:       'أخرى / Other',
};

export function ReportsExportButton({ data }: { data: {
  productionSummary: Array<{ code: string; nameAr: string; completed: number; month: string }>;
  defectAnalysis: Array<{ category: QualityDefectCategory; workCenterCode: string; workCenterNameAr: string; count: number }>;
  operatorActivity: Array<{ operatorId: string | null; starts: number; finishes: number; rejects: number; total: number }>;
  orderCompletion: Array<{ orderNumber: string; lineCount: number; totalOps: number; completedOps: number }>;
} }) {
  const rows: Record<string, string | number | boolean | null>[] = [];

  for (const r of data.productionSummary) {
    rows.push({ section: 'Production / الإنتاج', detail: `${r.code} — ${r.nameAr}`, value: r.completed, month: r.month });
  }

  if (data.defectAnalysis.length > 0) {
    rows.push({ section: '', detail: '', value: '', month: '' });
  }
  for (const r of data.defectAnalysis) {
    rows.push({ section: 'Defects / العيوب', detail: `${r.workCenterCode} — ${r.workCenterNameAr}`, value: r.count, month: CATEGORY_LABEL[r.category] });
  }

  if (data.operatorActivity.length > 0) {
    rows.push({ section: '', detail: '', value: '', month: '' });
  }
  for (const r of data.operatorActivity) {
    rows.push({ section: 'Operators / المشغلون', detail: r.operatorId ?? '', value: r.total, month: `S:${r.starts} F:${r.finishes} R:${r.rejects}` });
  }

  if (data.orderCompletion.length > 0) {
    rows.push({ section: '', detail: '', value: '', month: '' });
  }
  for (const r of data.orderCompletion) {
    const rate = r.totalOps > 0 ? Math.round((r.completedOps / r.totalOps) * 100) : 0;
    rows.push({ section: 'Orders / الطلبات', detail: r.orderNumber, value: `${r.completedOps}/${r.totalOps}`, month: `${rate}%` });
  }

  return (
    <ExportCsv
      data={rows}
      filename="reports.csv"
      headers={{
        section: 'Section / القسم',
        detail: 'Detail / التفاصيل',
        value: 'Value / القيمة',
        month: 'Month / الشهر',
      }}
    />
  );
}
