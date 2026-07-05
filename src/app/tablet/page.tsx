import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { db } from '@/db/db';
import { workCenter } from '@/db/schema';

export default async function TabletIndexPage() {
  const centers = await db
    .select({
      id: workCenter.id,
      code: workCenter.code,
      nameAr: workCenter.nameAr,
      nameEn: workCenter.nameEn,
    })
    .from(workCenter)
    .orderBy(asc(workCenter.code));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-2">e-pop · محطات العمل</h1>
      <p className="text-gray-400 mb-8 text-lg">اختر محطة العمل / Select Work Center</p>
      {centers.length === 0 ? (
        <p className="text-gray-500">لم يتم إضافة محطات عمل / No work centers configured</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-2xl">
          {centers.map((wc) => (
            <Link
              key={wc.id}
              href={`/tablet/${wc.id}`}
              className="bg-gray-800 hover:bg-gray-700 transition-colors rounded-2xl p-6 flex flex-col items-center gap-2 text-center min-h-[120px] justify-center"
            >
              <span className="text-xl font-bold">{wc.nameAr}</span>
              <span className="text-sm text-gray-400">{wc.nameEn}</span>
              <span className="text-xs text-gray-500 font-mono">{wc.code}</span>
            </Link>
          ))}
        </div>
      )}
      <div className="mt-8">
        <Link href="/admin/orders" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          ← Work Orders
        </Link>
      </div>
    </div>
  );
}
