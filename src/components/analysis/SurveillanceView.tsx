import { useMemo } from 'react';
import type { AnalysisResult, SurveillanceRatePoint } from '../../types';
import type { ProgramConfig } from '../../config/programs';
import { buildSurveillanceCharts } from '../../utils/reportCharts';
import ExecutiveSummary from './ExecutiveSummary';
import SignatureBlock from './SignatureBlock';

interface SurveillanceViewProps {
  analysis: AnalysisResult;
  program: ProgramConfig;
  auditName?: string;
  formula?: string;
  fileName: string;
  onEdit?: () => void;
}

const fmtRate = (r: number | null) => (r === null ? 's/d' : String(r));

/** Tabla de resultado por categoría (unidad o período) con alerta vs referencia. */
function RateTable({ points, firstHeader }: { points: SurveillanceRatePoint[]; firstHeader: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-3">{firstHeader}</th>
            <th className="py-2 pr-3 text-right">Casos</th>
            <th className="py-2 pr-3 text-right">Días CVC</th>
            <th className="py-2 pr-3 text-right">Tasa</th>
            <th className="py-2 text-right">Estado</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.key} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-3 font-medium text-slate-700">{p.label}</td>
              <td className="py-2 pr-3 text-right text-slate-600">{p.cases}</td>
              <td className="py-2 pr-3 text-right text-slate-600">{p.deviceDays}</td>
              <td className={`py-2 pr-3 text-right font-bold ${p.exceedsReference ? 'text-red-600' : 'text-slate-700'}`}>{fmtRate(p.rate)}</td>
              <td className="py-2 text-right">
                {p.rate === null ? (
                  <span className="text-slate-400">sin datos</span>
                ) : p.exceedsReference ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">⚠ Sobre referencia</span>
                ) : (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700">En referencia</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Dashboard de vigilancia epidemiológica (tasas). No usa cumplimiento ni semáforo de bundles. */
export default function SurveillanceView({ analysis, program, auditName, formula, fileName, onEdit }: SurveillanceViewProps) {
  const s = analysis.surveillance!;
  const charts = useMemo(() => buildSurveillanceCharts(s, program.traffic), [s, program.traffic]);

  const kpis: { label: string; value: string; hint?: string; tone?: 'alert' | 'ok' | 'neutral' }[] = [
    { label: 'Casos de ITS-CVC', value: String(s.totalCases), tone: 'neutral' },
    { label: 'Días CVC (denominador)', value: String(s.totalDeviceDays), tone: 'neutral' },
    {
      label: `Tasa global (${s.unitLabel})`,
      value: fmtRate(s.overallRate),
      hint: s.reference !== null ? `Referencia ${s.reference}` : undefined,
      tone: s.exceedsReference ? 'alert' : 'ok',
    },
    ...(s.utilizationRatio !== null ? [{ label: 'Razón de utilización de CVC', value: String(s.utilizationRatio), hint: 'días CVC / días paciente', tone: 'neutral' as const }] : []),
  ];

  const toneClass = (t?: 'alert' | 'ok' | 'neutral') =>
    t === 'alert' ? 'text-red-600' : t === 'ok' ? 'text-green-600' : 'text-slate-800';

  const missingCols = !s.numeratorFound || !s.denominatorFound;

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <header className="mb-3">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">🧫 Vigilancia epidemiológica</h3>
          <p className="mt-0.5 text-sm text-slate-400">
            {auditName ? `${auditName}: ` : ''}tasa <strong>{s.rateName}</strong> = casos / días de exposición × {s.factor} ({s.unitLabel}).
          </p>
          {formula && <p className="mt-1 text-xs text-slate-400">🧮 {formula}</p>}
        </header>

        {missingCols ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ⚠️ No se detectaron las columnas del {s.numeratorFound ? '' : 'numerador (casos)'}
            {!s.numeratorFound && !s.denominatorFound ? ' ni del ' : ''}
            {s.denominatorFound ? '' : 'denominador (días CVC)'}. Revisa que el Excel tenga columnas como «Casos ITS-CVC» y «Días CVC», o
            ajústalas en «Revisar columnas».
          </p>
        ) : s.exceedsReference ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            🚨 Alerta: la tasa global ({s.overallRate} {s.unitLabel}) supera la referencia de {s.reference}.
          </p>
        ) : s.reference !== null && s.overallRate !== null ? (
          <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            ✓ La tasa global ({s.overallRate} {s.unitLabel}) está en o bajo la referencia de {s.reference}.
          </p>
        ) : null}

        {/* KPIs */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className={`text-2xl font-black ${toneClass(k.tone)}`}>{k.value}</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">{k.label}</p>
              {k.hint && <p className="text-[11px] text-slate-400">{k.hint}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* Gráficos (tasa por unidad, evolución) */}
      {charts.length > 0 && (
        <section className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">📈 Gráficos de vigilancia</h3>
          <div className="grid gap-4 lg:grid-cols-2">
            {charts.map((c) => (
              <figure key={c.title} className="rounded-xl border border-slate-100 p-3">
                <figcaption className="mb-1 text-sm font-semibold text-slate-600">{c.title}</figcaption>
                <img src={c.dataUrl} alt={c.title} className="max-w-full" style={{ width: c.width, height: c.height }} />
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Resultado por unidad */}
      {s.byUnit.length > 0 && (
        <section className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">🏥 Resultado por unidad</h3>
          <RateTable points={s.byUnit} firstHeader="Unidad" />
        </section>
      )}

      {/* Resultado por período (evolución y comparación temporal) */}
      {s.hasDate && s.byPeriod.length > 0 && (
        <section className="card p-5">
          <h3 className="mb-1 flex items-center gap-2 text-base font-bold text-slate-800">🗓️ Resultado por período ({s.granularityLabel})</h3>
          <p className="mb-3 text-xs text-slate-400">Evolución y comparación temporal de la tasa.</p>
          <RateTable points={s.byPeriod} firstHeader="Período" />
        </section>
      )}

      {/* Resumen ejecutivo + exportación (usa el informe de vigilancia) */}
      <ExecutiveSummary analysis={analysis} fileName={fileName} onEdit={onEdit} />

      <SignatureBlock />
    </div>
  );
}
