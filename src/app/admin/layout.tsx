import Link from 'next/link';
import { getSession } from '@/lib/session';
import { logoutAction } from '@/app/login/actions';

const NAV = [
  { href: '/admin/departments',    label: 'Departments' },
  { href: '/admin/work-centers',   label: 'Work Centers' },
  { href: '/admin/models',         label: 'Models' },
  { href: '/admin/color-families', label: 'Color Families' },
  { href: '/admin/colors',         label: 'Colors' },
  { href: '/admin/routing',        label: 'Routing' },
  { href: '/admin/maintenance',    label: 'Maintenance' },
  { href: '/admin/quality',        label: 'Quality' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-52 bg-gray-900 text-white flex-shrink-0 flex flex-col">
        <div className="px-4 py-4 text-sm font-semibold tracking-wide text-gray-300 border-b border-gray-700">
          e-pop · Master Data
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="block px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            >
              {label}
            </Link>
          ))}
          {session?.role === 'ADMIN' && (
            <Link
              href="/admin/users"
              className="block px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            >
              Users
            </Link>
          )}
        </nav>
        {session && (
          <div className="px-4 py-3 border-t border-gray-700">
            <p className="text-xs font-medium text-gray-300 truncate">{session.displayName}</p>
            <p className="text-xs text-gray-500 mb-2">{session.role}</p>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                تسجيل الخروج / Logout
              </button>
            </form>
          </div>
        )}
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
