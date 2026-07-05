import { getLaborHours } from '@/db/labor';
import Link from 'next/link';
import { LaborExportButton } from './labor-export';
import { LaborTable } from './labor-table';

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonday(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - ((day + 6) % 7));
  r.setHours(0, 0, 0, 0);
  return r;
}

function getSunday(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() + ((6 - day + 1) % 7));
  r.setHours(0, 0, 0, 0);
  return r;
}

function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getDatesInWeek(monday: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export default async function LaborPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const today = new Date();
  const defaultMon = getMonday(today);
  const defaultSun = getSunday(today);

  const from = params.from || formatDate(defaultMon);
  const to = params.to || formatDate(defaultSun);

  const monday = new Date(from + 'T00:00:00.000Z');
  const prevMon = new Date(monday);
  prevMon.setDate(monday.getDate() - 7);
  const nextMon = new Date(monday);
  nextMon.setDate(monday.getDate() + 7);

  const prevFrom = formatDate(prevMon);
  const prevTo = formatDate(getSunday(prevMon));
  const nextFrom = formatDate(nextMon);
  const nextTo = formatDate(getSunday(nextMon));

  const dates = getDatesInWeek(monday);

  const records = await getLaborHours(from, to);

  type Detail = { date: string; operationId: number; workCenterCode: string; orderNumber: string; modelCode: string; minutes: number };

  const byOperator = new Map<string, Map<string, { minutes: number; details: Detail[] }>>();
  for (const r of records) {
    if (!byOperator.has(r.operatorId)) byOperator.set(r.operatorId, new Map());
    const dayMap = byOperator.get(r.operatorId)!;
    if (!dayMap.has(r.date)) dayMap.set(r.date, { minutes: 0, details: [] });
    const entry = dayMap.get(r.date)!;
    entry.minutes += r.minutes;
    entry.details.push({
      date: r.date,
      operationId: r.operationId,
      workCenterCode: r.workCenterCode,
      orderNumber: r.orderNumber,
      modelCode: r.modelCode,
      minutes: r.minutes,
    });
  }

  const operatorTotals = new Map<string, number>();
  for (const [opId, dayMap] of byOperator) {
    let total = 0;
    for (const { minutes } of dayMap.values()) total += minutes;
    operatorTotals.set(opId, total);
  }

  const allDetails = Array.from(byOperator.entries()).flatMap(([, dayMap]) =>
    Array.from(dayMap.values()).flatMap((entry) => entry.details),
  );

  const sortedOperators = Array.from(byOperator.keys()).sort(
    (a, b) => (operatorTotals.get(b) ?? 0) - (operatorTotals.get(a) ?? 0),
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Labor Hours / ساعات العمل</h1>
        <div className="flex items-center gap-3">
          <LaborExportButton details={allDetails} from={from} to={to} />
          <Link
            href={`/admin/labor?from=${prevFrom}&to=${prevTo}`}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            &larr; Previous / السابق
          </Link>
          <span className="text-sm text-gray-500">
            {from} — {to}
          </span>
          <Link
            href={`/admin/labor?from=${nextFrom}&to=${nextTo}`}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Next / التالي &rarr;
          </Link>
        </div>
      </div>

      {sortedOperators.length === 0 ? (
        <p className="text-sm text-gray-400">No labor data for this period / لا توجد بيانات لهذه الفترة</p>
      ) : (
        <LaborTable
          byOperator={byOperator}
          operatorTotals={operatorTotals}
          sortedOperators={sortedOperators}
          dates={dates}
        />
      )}

      {sortedOperators.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Details / التفاصيل
          </h2>
          {sortedOperators.map((opId) => {
            const dayMap = byOperator.get(opId)!;
            const allDetails = Array.from(dayMap.entries())
              .flatMap(([, v]) => v.details)
              .sort((a, b) => b.date.localeCompare(a.date));
            if (allDetails.length === 0) return null;
            return (
              <div key={opId} className="mb-4 last:mb-0">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  {opId}
                </h3>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs text-gray-500">Date / التاريخ</th>
                      <th className="px-3 py-2 text-left text-xs text-gray-500">Order / الأمر</th>
                      <th className="px-3 py-2 text-left text-xs text-gray-500">Model / الموديل</th>
                      <th className="px-3 py-2 text-left text-xs text-gray-500">Work Center / مركز العمل</th>
                      <th className="px-3 py-2 text-left text-xs text-gray-500">Hours / الساعات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allDetails.map((d, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2 text-gray-600 font-mono">{d.date}</td>
                        <td className="px-3 py-2 text-gray-800 font-mono">{d.orderNumber}</td>
                        <td className="px-3 py-2 text-gray-800">{d.modelCode}</td>
                        <td className="px-3 py-2 text-gray-800">{d.workCenterCode}</td>
                        <td className="px-3 py-2 text-gray-800 font-mono">{fmtHours(d.minutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
