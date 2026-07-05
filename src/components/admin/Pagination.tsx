import Link from 'next/link';

export function Pagination({
  currentPage,
  totalPages,
  basePath,
  params,
}: {
  currentPage: number;
  totalPages: number;
  basePath: string;
  params: Record<string, string>;
}) {
  function buildPageUrl(p: number) {
    const s = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) s.set(key, value);
    }
    if (p > 1) s.set('page', String(p));
    return `${basePath}${s.toString() ? '?' + s.toString() : ''}`;
  }

  return (
    <div className="flex items-center justify-between mt-6 text-sm text-gray-400">
      <div>
        Page {currentPage} of {Math.max(1, totalPages)} / صفحة {currentPage} من {Math.max(1, totalPages)}
      </div>
      <div className="flex gap-4">
        {currentPage > 1 ? (
          <Link href={buildPageUrl(currentPage - 1)} className="text-blue-400 hover:text-blue-300 transition-colors">
            Previous / السابق
          </Link>
        ) : (
          <span className="text-gray-600">Previous / السابق</span>
        )}
        {currentPage < totalPages ? (
          <Link href={buildPageUrl(currentPage + 1)} className="text-blue-400 hover:text-blue-300 transition-colors">
            Next / التالي
          </Link>
        ) : (
          <span className="text-gray-600">Next / التالي</span>
        )}
      </div>
    </div>
  );
}
