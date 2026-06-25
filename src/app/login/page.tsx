'use client';
import { useActionState } from 'react';
import { loginAction } from './actions';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '';
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          اسم المستخدم / Username
        </label>
        <input
          type="text"
          name="username"
          required
          autoComplete="username"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          كلمة المرور / Password
        </label>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {state?.error && (
        <p className="text-red-600 text-sm">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {pending ? 'جارٍ تسجيل الدخول…' : 'تسجيل الدخول / Sign In'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white shadow rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-1 text-center">e-pop MES</h1>
        <p className="text-sm text-gray-500 text-center mb-6">تسجيل الدخول / Sign In</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
