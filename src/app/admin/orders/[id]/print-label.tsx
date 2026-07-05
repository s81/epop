'use client'
import { printLabel } from '@/components/admin/LabelPrint'

export function PrintOrderLabel({
  orderNumber,
  modelInfo,
  totalQty,
  createdAt,
}: {
  orderNumber: string
  modelInfo: string
  totalQty: number
  createdAt: string | null
}) {
  return (
    <button
      type="button"
      onClick={() =>
        printLabel(orderNumber, [
          { label: 'Order / الأمر', value: orderNumber },
          { label: 'Model / الموديل', value: modelInfo },
          { label: 'Qty / الكمية', value: String(totalQty) },
          { label: 'Created / الإنشاء', value: createdAt ?? '—' },
        ])
      }
      className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
    >
      Print Label / طباعة بطاقة
    </button>
  )
}
