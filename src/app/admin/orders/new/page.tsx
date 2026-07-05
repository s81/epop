import { asc } from 'drizzle-orm';
import { db } from '@/db/db';
import { color, model } from '@/db/schema';
import { NewOrderForm } from './new-order-form';

export default async function NewOrderPage() {
  const [models, colors] = await Promise.all([
    db
      .select({ id: model.id, code: model.code, nameAr: model.nameAr, nameEn: model.nameEn })
      .from(model)
      .orderBy(asc(model.code)),
    db
      .select({ id: color.id, code: color.code, nameEn: color.nameEn })
      .from(color)
      .orderBy(asc(color.code)),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">
        New Order / أمر إنتاج جديد
      </h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-lg">
        <NewOrderForm models={models} colors={colors} />
      </div>
    </div>
  );
}
