'use client';

import { ExportCsv } from '@/components/admin/ExportCsv';

type Detail = { date: string; operationId: number; workCenterCode: string; orderNumber: string; modelCode: string; minutes: number };

export function LaborExportButton({ details, from, to }: { details: Detail[]; from: string; to: string }) {
  return (
    <ExportCsv
      data={details.map((d) => ({
        date: d.date,
        orderNumber: d.orderNumber,
        modelCode: d.modelCode,
        workCenterCode: d.workCenterCode,
        minutes: Math.round(d.minutes / 60 * 100) / 100,
      }))}
      filename={`labor-${from}-${to}.csv`}
      headers={{
        date: 'Date / التاريخ',
        orderNumber: 'Order / رقم الأمر',
        modelCode: 'Model / الموديل',
        workCenterCode: 'Work Center / مركز العمل',
        minutes: 'Hours / الساعات',
      }}
    />
  );
}