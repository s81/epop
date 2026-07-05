'use client';

import { ExportCsv } from '@/components/admin/ExportCsv';

export function OrdersExportButton({ orders }: { orders: Array<{
  orderNumber: string;
  modelCodes: string;
  totalQuantity: number;
  status: string;
  createdAt: string | null;
}>}) {
  return (
    <ExportCsv
      data={orders.map(o => ({
        orderNumber: o.orderNumber,
        modelCodes: o.modelCodes,
        totalQuantity: o.totalQuantity,
        status: o.status,
        createdAt: o.createdAt ?? '',
      }))}
      filename="orders.csv"
      headers={{
        orderNumber: 'Order / رقم الأمر',
        modelCodes: 'Model / الموديل',
        totalQuantity: 'Qty / الكمية',
        status: 'Status / الحالة',
        createdAt: 'Created / تاريخ الإنشاء',
      }}
    />
  );
}
