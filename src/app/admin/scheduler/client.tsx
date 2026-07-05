'use client';
import { useState } from 'react';
import type { runScheduleAction, clearScheduleAction } from './actions';
import { rescheduleOperation } from './actions';
import { GanttChart } from './gantt';
import { ExportCsv } from '@/components/admin/ExportCsv';
import { printLabels } from '@/components/admin/LabelPrint';

type OperationRow = {
  id: number;
  orderNumber: string;
  modelCode: string;
  modelNameAr: string;
  quantity: number;
  sequence: number;
  workCenterCode: string;
  workCenterNameAr: string;
  status: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
};

export function SchedulerClient({
  operations,
  shiftSummary,
  onRun,
  onClear,
}: {
  operations: OperationRow[];
  shiftSummary: { workingDays: number; totalDays: number; startTime: string; endTime: string };
  onRun: typeof runScheduleAction;
  onClear: typeof clearScheduleAction;
}) {
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [running, setRunning] = useState(false);

  const unscheduledCount = operations.filter((o) => !o.scheduledStart).length;
  const wcGroups = groupBy(operations, 'workCenterCode');

  async function handleRun(fd: FormData) {
    setRunning(true);
    setMessage(null);
    try {
      const r = await onRun();
      if (r.errors?.length) {
        setMessage({ text: `Cleared ${r.cleared} · Scheduled ${r.scheduled} (${r.errors.length} errors)`, type: 'error' });
      } else {
        setMessage({ text: `Cleared ${r.cleared} · Scheduled ${r.scheduled} operations`, type: 'success' });
      }
    } catch {
      setMessage({ text: 'Scheduler failed', type: 'error' });
    } finally {
      setRunning(false);
    }
  }

  async function handleClear(fd: FormData) {
    setMessage(null);
    try {
      const r = await onClear();
      setMessage({ text: `Cleared ${r.cleared} scheduled times`, type: 'info' });
    } catch {
      setMessage({ text: 'Clear failed', type: 'error' });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Scheduler / جدولة
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {operations.length} operations · {unscheduledCount} unscheduled ·{' '}
            Shift {shiftSummary.startTime}–{shiftSummary.endTime}{' '}
            ({shiftSummary.workingDays}/{shiftSummary.totalDays} working days seeded)
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {opsByStatus('QUEUED', operations)} QUEUED · {opsByStatus('IN_PROGRESS', operations)} IN_PROGRESS · {opsByStatus('COMPLETED', operations)} COMPLETED · {opsByStatus('REJECTED', operations)} REJECTED
          </p>
        </div>
        <div className="flex gap-3 no-print">
          <ExportCsv
            data={operations.map(o => ({
              orderNumber: o.orderNumber,
              modelCode: `${o.modelCode} — ${o.modelNameAr}`,
              sequence: o.sequence,
              quantity: o.quantity,
              status: o.status,
              workCenterCode: o.workCenterCode,
              scheduledStart: o.scheduledStart ?? '',
              scheduledEnd: o.scheduledEnd ?? '',
            }))}
            filename="scheduler.csv"
            headers={{
              orderNumber: 'Order / رقم الأمر',
              modelCode: 'Model / الموديل',
              sequence: 'Seq / الترتيب',
              quantity: 'Qty / الكمية',
              status: 'Status / الحالة',
              workCenterCode: 'WC / مركز العمل',
              scheduledStart: 'Start / البداية',
              scheduledEnd: 'End / النهاية',
            }}
          />
          <button
            type="button"
            onClick={() => window.print()}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Print / طباعة
          </button>
          <button
            type="button"
            onClick={() =>
              printLabels(
                operations.map(op => ({
                  barcode: `OP-${String(op.id).padStart(6, '0')}`,
                  fields: [
                    { label: 'Order / الأمر', value: op.orderNumber },
                    { label: 'Model / الموديل', value: `${op.modelCode} — ${op.modelNameAr}` },
                    { label: 'WC / مركز العمل', value: `${op.workCenterCode} — ${op.workCenterNameAr}` },
                    { label: 'Seq / التسلسل', value: String(op.sequence) },
                    { label: 'Qty / الكمية', value: String(op.quantity) },
                  ],
                }))
              )
            }
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Print Labels / طباعة البطاقات
          </button>
          <form action={handleClear}>
            <button
              type="submit"
              disabled={running}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Clear Schedule
            </button>
          </form>
          <form action={handleRun}>
            <button
              type="submit"
              disabled={running}
              className="bg-indigo-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {running ? 'Running…' : 'Run Scheduler'}
            </button>
          </form>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-3 rounded-md text-sm border no-print ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' :
          message.type === 'error' ? 'bg-amber-50 text-amber-800 border-amber-200' :
          'bg-blue-50 text-blue-800 border-blue-200'
        }`}>
          {message.text}
        </div>
      )}

      {operations.some(o => o.scheduledStart) && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-2 no-print">Gantt / مخطط زمني</h2>
          <GanttChart operations={operations} onReschedule={rescheduleOperation} />
        </div>
      )}

      {operations.length === 0 ? (
        <p className="text-gray-500 text-sm no-print">No released work orders with queued operations.</p>
      ) : (
        <div className="space-y-6 no-print">
          {Object.entries(wcGroups).map(([wcCode, ops]) => (
            <div key={wcCode}>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">
                {ops[0].workCenterNameAr} ({wcCode})
              </h2>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Order</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Model</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Seq</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Qty</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Start</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">End</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ops.map((op) => (
                      <tr key={op.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2 font-mono text-xs text-gray-800">{op.orderNumber}</td>
                        <td className="px-3 py-2 text-gray-800 whitespace-nowrap">
                          {op.modelCode} — {op.modelNameAr}
                        </td>
                        <td className="px-3 py-2 text-gray-500">{op.sequence}</td>
                        <td className="px-3 py-2 text-gray-500">{op.quantity}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                            ${op.status === 'QUEUED' ? 'bg-gray-100 text-gray-600' : ''}
                            ${op.status === 'IN_PROGRESS' ? 'bg-green-100 text-green-700' : ''}
                            ${op.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' : ''}
                          `}>
                            {op.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 font-mono whitespace-nowrap">
                          {op.scheduledStart ? formatTime(op.scheduledStart) : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 font-mono whitespace-nowrap">
                          {op.scheduledEnd ? formatTime(op.scheduledEnd) : '—'}
                        </td>
                      </tr>
                    ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td className="px-3 py-2 text-xs font-semibold text-gray-600" colSpan={2}>
                          Total / المجموع
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold text-gray-600">{ops.length}</td>
                        <td className="px-3 py-2 text-xs font-semibold text-gray-600">
                          {ops.reduce((s, o) => s + o.quantity, 0)}
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold text-gray-600" colSpan={3}>
                          {opsByStatus('QUEUED', ops)}Q · {opsByStatus('IN_PROGRESS', ops)}IP · {opsByStatus('COMPLETED', ops)}C
                        </td>
                      </tr>
                    </tfoot>
                  </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupBy<T extends Record<string, unknown>>(arr: T[], key: string): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const item of arr) {
    const k = String(item[key]);
    if (!map[k]) map[k] = [];
    map[k].push(item);
  }
  return map;
}

function opsByStatus(status: string, ops: OperationRow[]): number {
  return ops.filter((o) => o.status === status).length;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
