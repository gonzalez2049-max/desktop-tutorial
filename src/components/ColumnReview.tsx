import type { ReactNode } from 'react';
import type { ColumnRole, DetectedColumn } from '../types';

interface ColumnReviewProps {
  columns: DetectedColumn[];
  onChange: (columns: DetectedColumn[]) => void;
  onConfirm: () => void;
  onBack: () => void;
  /** Vista previa de datos que se muestra sobre la detección de columnas. */
  preview?: ReactNode;
}

const ROLE_LABELS: Record<ColumnRole, string> = {
  unidad: 'Unidad / Servicio',
  turno: 'Turno / Jornada',
  indicador: 'Indicador / Ítem',
  cumplimiento: 'Cumplimiento (Sí/No)',
  descriptivo: 'Variable descriptiva (prevalencia)',
  fecha: 'Fecha / Periodo',
  paciente: 'Paciente',
  riesgo: 'Nivel de riesgo',
  valor: 'Valor',
  desconocido: 'Ignorar',
};

const ROLE_ORDER: ColumnRole[] = ['cumplimiento', 'descriptivo', 'unidad', 'turno', 'indicador', 'fecha', 'riesgo', 'paciente', 'valor', 'desconocido'];

function confidenceBadge(c: number) {
  if (c >= 0.85) return { text: 'Alta', cls: 'bg-green-100 text-green-700' };
  if (c >= 0.6) return { text: 'Media', cls: 'bg-amber-100 text-amber-700' };
  if (c > 0) return { text: 'Baja', cls: 'bg-slate-100 text-slate-500' };
  return { text: '—', cls: 'bg-slate-100 text-slate-400' };
}

/**
 * Paso 2: revisión de la detección automática de columnas.
 * El usuario puede corregir cualquier asignación antes de continuar.
 */
export default function ColumnReview({ columns, onChange, onConfirm, onBack, preview }: ColumnReviewProps) {
  const hasCompliance = columns.some((c) => c.role === 'cumplimiento');

  const setRole = (original: string, role: ColumnRole) => {
    onChange(columns.map((c) => (c.original === original ? { ...c, role, confidence: c.role === role ? c.confidence : 1 } : c)));
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Leí tu archivo 🔍</h2>
        <p className="mt-2 text-slate-500">
          Detecté automáticamente el rol de cada columna. Revisa la vista previa y, si algo no calza, ajústalo. No dependo del nombre exacto.
        </p>
      </div>

      {preview && <div className="card p-4 mb-6">{preview}</div>}

      <h3 className="mb-2 text-sm font-semibold text-slate-600">Columnas detectadas</h3>
      <div className="card divide-y divide-slate-100">
        {columns.map((col) => {
          const badge = confidenceBadge(col.confidence);
          return (
            <div key={col.original} className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-slate-800">{col.original}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>
                  Confianza: {badge.text}
                </span>
              </div>
              <select
                value={col.role}
                onChange={(e) => setRole(col.original, e.target.value as ColumnRole)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-nex-500 focus:outline-none focus:ring-2 focus:ring-nex-200"
              >
                {ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {!hasCompliance && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          ⚠️ No detecté ninguna columna de <strong>cumplimiento</strong>. Marca al menos una columna como “Cumplimiento (Sí/No)” para poder analizar.
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button className="btn-ghost" onClick={onBack}>
          ← Volver
        </button>
        <button className="btn-primary" onClick={onConfirm} disabled={!hasCompliance}>
          Confirmar y continuar →
        </button>
      </div>
    </div>
  );
}
