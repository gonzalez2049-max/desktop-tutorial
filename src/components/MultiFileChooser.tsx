import { useMemo, useState } from 'react';
import type { ParsedWorkbook } from '../types';
import { columnForRole } from '../utils/columnDetection';

interface Props {
  workbooks: ParsedWorkbook[];
  onMonths: () => void;
  onUnits: (unitByFile: Record<string, string>) => void;
  onBack: () => void;
}

/** Etiqueta sugerida de unidad para un archivo (columna de unidad o nombre). */
function suggestedUnit(wb: ParsedWorkbook): string {
  const col = columnForRole(wb.columns, 'unidad');
  if (col) {
    const vals = new Set(wb.rows.map((r) => String(r[col] ?? '').trim()).filter(Boolean));
    if (vals.size === 1) return [...vals][0];
    if (vals.size > 1) return `${vals.size} unidades en el archivo`;
  }
  return wb.fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || wb.fileName;
}

/**
 * Tras cargar varios archivos, deja elegir qué representa cada uno:
 *  - un MES de la misma auditoría → comparativo mensual;
 *  - una UNIDAD del mes → informe consolidado por unidad (exportable).
 */
export default function MultiFileChooser({ workbooks, onMonths, onUnits, onBack }: Props) {
  const [mode, setMode] = useState<'meses' | 'unidades' | null>(null);
  const suggestions = useMemo(() => workbooks.map(suggestedUnit), [workbooks]);
  const [units, setUnits] = useState<string[]>(suggestions);

  const confirmUnits = () => {
    const map: Record<string, string> = {};
    workbooks.forEach((wb, i) => { map[wb.fileName] = units[i]; });
    onUnits(map);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-black text-slate-800">Cargaste {workbooks.length} archivos</h2>
        <p className="mt-1 text-slate-500">¿Qué representa cada archivo? Elige cómo quieres procesarlos.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode('meses')}
          className={`rounded-2xl border-2 p-5 text-left transition ${mode === 'meses' ? 'border-nex-500 bg-nex-50' : 'border-slate-200 bg-white hover:border-nex-300'}`}
        >
          <div className="text-2xl">📅</div>
          <p className="mt-2 font-bold text-slate-800">Cada archivo es un mes</p>
          <p className="mt-0.5 text-sm text-slate-500">Comparativo mensual: evolución del cumplimiento período a período.</p>
        </button>

        <button
          type="button"
          onClick={() => setMode('unidades')}
          className={`rounded-2xl border-2 p-5 text-left transition ${mode === 'unidades' ? 'border-nex-500 bg-nex-50' : 'border-slate-200 bg-white hover:border-nex-300'}`}
        >
          <div className="text-2xl">🏥</div>
          <p className="mt-2 font-bold text-slate-800">Cada archivo es una unidad</p>
          <p className="mt-0.5 text-sm text-slate-500">Informe consolidado del mes por servicio, listo para exportar y entregar.</p>
        </button>
      </div>

      {mode === 'meses' && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Se comparará el cumplimiento de los {workbooks.length} meses. Podrás renombrar y ordenar los meses en la vista.</p>
          <ul className="mt-3 space-y-1.5">
            {workbooks.map((wb) => (
              <li key={wb.fileName} className="truncate text-sm text-slate-500">📄 {wb.fileName}</li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={onMonths} className="btn-primary">Ver comparativo mensual →</button>
          </div>
        </div>
      )}

      {mode === 'unidades' && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">
            Cada archivo se toma como una unidad y se consolidan en un solo informe. Revisa o corrige el nombre de cada unidad.
          </p>
          <div className="mt-3 space-y-2">
            {workbooks.map((wb, i) => (
              <div key={wb.fileName} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5">
                <span className="min-w-0 flex-1 truncate text-xs text-slate-400" title={wb.fileName}>📄 {wb.fileName}</span>
                <input
                  value={units[i]}
                  onChange={(e) => setUnits((u) => u.map((v, j) => (j === i ? e.target.value : v)))}
                  className="w-1/2 shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-nex-500 focus:outline-none focus:ring-2 focus:ring-nex-200"
                  aria-label={`Nombre de la unidad del archivo ${wb.fileName}`}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Si un archivo ya trae su propia columna de unidad, se respeta ese valor en cada fila; el nombre de aquí se usa como respaldo.
          </p>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={confirmUnits} className="btn-primary">Generar informe consolidado →</button>
          </div>
        </div>
      )}

      <div className="mt-5">
        <button type="button" onClick={onBack} className="text-sm font-semibold text-slate-500 hover:text-nex-700">← Volver a la carga</button>
      </div>
    </div>
  );
}
