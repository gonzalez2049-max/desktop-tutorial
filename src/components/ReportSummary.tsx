import type { ReportSummary as Summary } from '../types';
import { highlightLabel, reportTypeLabel } from '../config/options';

interface ReportSummaryProps {
  summary: Summary;
  fileName: string;
  onReset: () => void;
}

const DIM_LABELS: Record<keyof Summary['detectedDimensions'], string> = {
  unidad: 'Unidad / Servicio',
  turno: 'Turno / Jornada',
  indicador: 'Indicador',
  fecha: 'Fecha / Periodo',
  riesgo: 'Nivel de riesgo',
};

/**
 * Resultado de "Generar reporte" en la primera versión: confirma que la lectura
 * del Excel y la configuración inteligente funcionan. El dashboard, PDF y Word
 * se construirán en la próxima entrega.
 */
export default function ReportSummary({ summary, fileName, onReset }: ReportSummaryProps) {
  const { config } = summary;
  const goalColor = summary.meetsGoal ? 'text-green-600' : 'text-amber-600';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Reporte configurado ✅</h2>
          <p className="mt-1 text-slate-500">
            {reportTypeLabel(config.reportType)} · <span className="text-slate-400">{fileName}</span>
          </p>
        </div>
        <button className="btn-ghost" onClick={onReset}>
          ↺ Nuevo reporte
        </button>
      </div>

      {/* KPIs básicos que confirman la lectura del Excel */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500">Cumplimiento global</p>
          <p className={`mt-1 text-2xl font-extrabold ${goalColor}`}>{summary.globalPercent}%</p>
          <p className="mt-0.5 text-xs text-slate-400">Meta {config.goal}%</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500">Filas leídas</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-800">{summary.totalRows}</p>
          <p className="mt-0.5 text-xs text-slate-400">{summary.applicableRows} aplicables</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500">Cumple</p>
          <p className="mt-1 text-2xl font-extrabold text-green-600">{summary.cumple}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500">No cumple</p>
          <p className="mt-1 text-2xl font-extrabold text-red-500">{summary.noCumple}</p>
        </div>
      </div>

      {/* Eco de la configuración elegida en el wizard */}
      <div className="card p-5">
        <h3 className="mb-3 text-base font-bold text-slate-800">Configuración del informe</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <dt className="w-40 shrink-0 font-medium text-slate-500">Tipo de informe</dt>
            <dd className="font-semibold text-slate-700">{reportTypeLabel(config.reportType)}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="w-40 shrink-0 font-medium text-slate-500">Datos a destacar</dt>
            <dd className="flex flex-1 flex-wrap gap-1.5">
              {config.highlights.map((h) => (
                <span key={h} className="rounded-full bg-nex-50 px-2.5 py-0.5 text-xs font-semibold text-nex-700">
                  {highlightLabel(h)}
                </span>
              ))}
            </dd>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <dt className="w-40 shrink-0 font-medium text-slate-500">Meta de cumplimiento</dt>
            <dd className="font-semibold text-slate-700">{config.goal}%</dd>
          </div>
        </dl>
      </div>

      {/* Dimensiones detectadas automáticamente */}
      <div className="card p-5">
        <h3 className="mb-3 text-base font-bold text-slate-800">Dimensiones detectadas en tu Excel</h3>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(summary.detectedDimensions) as (keyof Summary['detectedDimensions'])[]).map((k) => {
            const ok = summary.detectedDimensions[k];
            return (
              <span
                key={k}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${ok ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}
              >
                {ok ? '✓' : '—'} {DIM_LABELS[k]}
              </span>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-nex-100 bg-nex-50 p-4 text-sm text-nex-800">
        🚧 <strong>Próxima entrega:</strong> con esta base ya funcionando (carga de Excel + configuración inteligente),
        los siguientes pasos serán el dashboard visual, los gráficos y la exportación a PDF y Word.
      </div>
    </div>
  );
}
