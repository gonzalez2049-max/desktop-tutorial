import type { ParsedWorkbook } from '../types';
import { columnForRole } from '../utils/columnDetection';

/** Muestra una vista previa de las primeras filas del Excel cargado. */
export default function DataPreview({ workbook, maxRows = 8 }: { workbook: ParsedWorkbook; maxRows?: number }) {
  const rows = workbook.rows.slice(0, maxRows);
  const complianceCol = columnForRole(workbook.columns, 'cumplimiento');

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-600">
          Vista previa · <span className="font-normal text-slate-400">mostrando {rows.length} de {workbook.rows.length} filas</span>
        </p>
        <span className="text-xs text-slate-400">Hoja: {workbook.sheetName}</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              {workbook.headers.map((h) => (
                <th key={h} className={`whitespace-nowrap px-3 py-2 font-semibold ${h === complianceCol ? 'text-nex-700' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-slate-100">
                {workbook.headers.map((h) => (
                  <td key={h} className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {row[h] === null || row[h] === undefined || row[h] === '' ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      String(row[h])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
