import Link from 'next/link';

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-52 bg-gray-900 text-white flex-shrink-0 flex flex-col">
        <div className="px-4 py-4 text-sm font-semibold tracking-wide text-gray-300 border-b border-gray-700">
          e-pop · Orders
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          <Link
            href="/orders"
            className="block px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            Work Orders
          </Link>
        </nav>
        <div className="px-4 py-3 border-t border-gray-700 flex flex-col gap-1">
          <Link href="/tablet" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            Tablet →
          </Link>
          <Link href="/admin" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            ← Master Data
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
