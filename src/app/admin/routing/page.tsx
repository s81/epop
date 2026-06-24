import Link from 'next/link';
import { asc, count, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { model, routingStep } from '@/db/schema';

export default async function RoutingPage() {
  const models = await db
    .select({
      id: model.id,
      code: model.code,
      nameAr: model.nameAr,
      nameEn: model.nameEn,
      stepCount: count(routingStep.id),
    })
    .from(model)
    .leftJoin(routingStep, eq(routingStep.modelId, model.id))
    .groupBy(model.id)
    .orderBy(asc(model.code));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Routing</h1>
        <p className="text-sm text-gray-500 mt-1">
          Click a model to manage its ordered work-center steps.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Arabic Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">English Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Steps</th>
              <th className="px-4 py-3 w-28" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {models.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                  No models yet —{' '}
                  <Link href="/admin/models" className="text-blue-600 hover:underline">
                    add models first
                  </Link>
                </td>
              </tr>
            )}
            {models.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{m.code}</td>
                <td className="px-4 py-3 text-gray-800" dir="rtl">{m.nameAr}</td>
                <td className="px-4 py-3 text-gray-800">{m.nameEn}</td>
                <td className="px-4 py-3 text-gray-500">
                  {m.stepCount === 0 ? (
                    <span className="text-amber-500">0 steps</span>
                  ) : (
                    `${m.stepCount} step${m.stepCount !== 1 ? 's' : ''}`
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/routing/${m.id}`}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
