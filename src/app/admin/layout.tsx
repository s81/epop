import Link from 'next/link';

const NAV = [
  { href: '/admin/departments',   label: 'Departments' },
  { href: '/admin/work-centers',  label: 'Work Centers' },
  { href: '/admin/models',        label: 'Models' },
  { href: '/admin/color-families',label: 'Color Families' },
  { href: '/admin/colors',        label: 'Colors' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-52 bg-gray-900 text-white flex-shrink-0 flex flex-col">
        <div className="px-4 py-4 text-sm font-semibold tracking-wide text-gray-300 border-b border-gray-700">
          e-pop · Master Data
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="block px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
