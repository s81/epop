'use client';
import { useState } from 'react';
import { UserForm } from './form';
import type { UserRole } from '@/db/schema';
import type { deleteUser } from './actions';

type UserRow = {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  lastLoginAt: string | null;
};

const ROLE_BADGE: Record<UserRole, string> = {
  VIEWER: 'bg-gray-100 text-gray-700',
  DATA_ENTRY: 'bg-blue-100 text-blue-700',
  ADMIN: 'bg-purple-100 text-purple-700',
};

export function UsersClient({
  data,
  currentUserId,
  onDelete,
}: {
  data: UserRow[];
  currentUserId: number;
  onDelete: typeof deleteUser;
}) {
  const [editing, setEditing] = useState<UserRow | null | 'new'>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">المستخدمون / Users</h1>
        <button
          onClick={() => setEditing('new')}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + إضافة مستخدم / Add User
        </button>
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">
              {editing === 'new' ? 'إضافة مستخدم / Add User' : 'تعديل / Edit User'}
            </h2>
            <UserForm
              item={editing === 'new' ? undefined : editing}
              onSuccess={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Display Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Username</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Last Login</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.displayName}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ROLE_BADGE[u.role]}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => setEditing(u)}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    Edit
                  </button>
                  {u.id !== currentUserId && (
                    <form
                      action={onDelete}
                      className="inline"
                      onSubmit={(e) => {
                        if (!confirm(`Delete ${u.displayName}?`)) e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="id" value={u.id} />
                      <button type="submit" className="text-red-600 hover:text-red-800 text-xs font-medium ml-2">
                        Delete
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
