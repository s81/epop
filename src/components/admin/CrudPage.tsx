'use client';
import { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';

export type Column<T> = {
  key: keyof T & string;
  header: string;
  rtl?: boolean;
};

export type CrudPageProps<T extends { id: number }> = {
  title: string;
  data: T[];
  columns: Column<T>[];
  FormComponent: React.ComponentType<{
    item?: T;
    onSuccess: () => void;
    [key: string]: unknown;
  }>;
  onDelete: (formData: FormData) => Promise<void>;
  formProps?: Record<string, unknown>;
};

export function CrudPage<T extends { id: number }>({
  title,
  data,
  columns,
  FormComponent,
  onDelete,
  formProps = {},
}: CrudPageProps<T>) {
  const [dialog, setDialog] = useState<{ open: boolean; item?: T }>({ open: false });

  const close = () => setDialog({ open: false });
  const singular = title.replace(/ies$/, 'y').replace(/s$/, '');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <button
          onClick={() => setDialog({ open: true, item: undefined })}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + New {singular}
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                >
                  {col.header}
                </th>
              ))}
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-10 text-center text-sm text-gray-400"
                >
                  No {title.toLowerCase()} yet
                </td>
              </tr>
            )}
            {data.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    dir={col.rtl ? 'rtl' : undefined}
                    className="px-4 py-3 text-gray-800"
                  >
                    {String(item[col.key] ?? '')}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setDialog({ open: true, item })}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      Edit
                    </button>
                    <form action={onDelete} className="inline">
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        type="submit"
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                        onClick={(e) => {
                          if (!confirm(`Delete this ${singular.toLowerCase()}?`)) {
                            e.preventDefault();
                          }
                        }}
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={dialog.open}
        onClose={close}
        title={dialog.item ? `Edit ${singular}` : `New ${singular}`}
      >
        <FormComponent
          key={dialog.item?.id ?? 'new'}
          item={dialog.item}
          onSuccess={close}
          {...formProps}
        />
      </Dialog>
    </div>
  );
}
