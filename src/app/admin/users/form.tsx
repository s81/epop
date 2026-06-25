'use client';
import { useActionState, useEffect } from 'react';
import { saveUser } from './actions';
import { USER_ROLES } from '@/db/schema';
import type { UserRole } from '@/db/schema';

type UserItem = {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
};

export function UserForm({
  item,
  onSuccess,
  onCancel,
}: {
  item?: UserItem;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(saveUser, null);

  useEffect(() => {
    if (state && 'success' in state) onSuccess();
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      {item && <input type="hidden" name="id" value={item.id} />}

      {!item && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            type="text"
            name="username"
            required
            autoComplete="off"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          الاسم / Display Name
        </label>
        <input
          type="text"
          name="displayName"
          defaultValue={item?.displayName}
          required
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
        <select
          name="role"
          defaultValue={item?.role ?? 'VIEWER'}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {item ? 'New Password (leave blank to keep)' : 'Password'}
        </label>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required={!item}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {state && 'error' in state && (
        <p className="text-red-500 text-sm">{state.error}</p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          إلغاء / Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
