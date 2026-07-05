'use client';

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function ExportCsv({ data, filename, headers }: {
  data: Record<string, string | number | boolean | null | undefined>[];
  filename: string;
  headers: Record<string, string>;
}) {
  function handleExport() {
    const headerRow = Object.values(headers).map(csvEscape).join(',');
    const dataRows = data.map(row =>
      Object.keys(headers).map(key => {
        const val = row[key];
        if (val === null || val === undefined) return '';
        return csvEscape(String(val));
      }).join(',')
    );
    const csv = '\uFEFF' + [headerRow, ...dataRows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
    >
      Export CSV / تصدير
    </button>
  );
}
