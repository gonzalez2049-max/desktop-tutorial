import { useMemo, useState } from 'react';
import type { ParsedWorkbook, ReportConfig, SurveillanceRatePoint } from '../../types';
import type { ProgramConfig } from '../../config/programs';
import { analyze } from '../../utils/analysis';
import { buildSurveillanceCharts } from '../../utils/reportCharts';
import ExecutiveSummary from './ExecutiveSummary';
import SignatureBlock from './SignatureBlock';

interface SurveillanceViewProps {
  workbook: ParsedWorkbook;
  config: ReportConfig;
  program: ProgramConfig;
  auditName?: string;
  formula?: string;
  fileName: string;
  onEdit?: () => void;
}

const AUTO = '__AUTO__';
const fmtRate = (r: number | null) => (r === null ? 's/d' : String(r));

/** Tabla de resultado por categoría (unidad o período) con referencia y alerta. */
function RateTable({ points, firstHeader, showService }: { points: SurveillanceRatePoint[]; firstHeader: string; showService: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-3">{firstHeader}</th>
            {showService && <th className="py-2 pr-3">Servicio</th>}
            <th className="py-2 pr-3 text-right">Casos</th>
            <th className="py-2 pr-3 text-right">Días</th>
            <th className="py-2 pr-3 text-right">Tasa</th>
            <th className="py-2 pr-3 text-right">Ref.</th>
            <th className="py-2 text-right">Estado</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.key} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-3 font-medium text-slate-700">{p.label}</td>
              {showService && <td className="py-2 pr-3 text-slate-500">{p.serviceLabel ?? '—'}</td>}
              <td className="py-2 pr-3 text-right text-slate-600">{p.cases}</td>
              <td className="py-2 pr-3 text-right text-slate-600">{p.deviceDays}</td>
              <td className={`py-2 pr-3 text-right font-bold ${p.exceedsReference ? 'text-red-600' : 'text-slate-700'}`}>{fmtRate(p.rate)}</td>
              <td className="py-2 pr-3 text-right text-slate-500">{p.reference ?? '—'}</td>
              <td className="py-2 text-right">
                {p.rate === null ? (
                  <span className="text-slate-400">sin datos</span>
                ) : p.reference === null ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">sin referencia</span>
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
export default function SurveillanceView({ workbook, config, program, auditName, formula, fileName, onEdit }: SurveillanceViewProps) {
  // Selección manual del tipo de servicio (fija la referencia). '' = automático.
  const [service, setService] = useState<string>(config.serviceType ?? AUTO);
  const effectiveConfig = useMemo<ReportConfig>(() => ({ ...config, serviceType: service === AUTO ? undefined : service }), [config, service]);
  const analysis = useMemo(() => analyze(workbook, effectiveConfig), [workbook, effectiveConfig]);
  const s = analysis.surveillance!;
  const charts = useMemo(() => buildSurveillanceCharts(s, program.traffic), [s, program.traffic]);

  const kpis: { label: string; value: string; hint?: string; tone?: 'alert' | 'ok' | 'neutral' }[] = [
    { label: s.numeratorLabel, value: String(s.totalCases), tone: 'neutral' },
    { label: `${s.denominatorLabel} (denominador)`, value: String(s.totalDeviceDays), tone: 'neutral' },
    {
      label: `Tasa global (${s.unitLabel})`,
      value: fmtRate(s.overallRate),
      hint: s.reference !== null ? `Referencia ${s.reference}` : s.referenceMode === 'per_unit' ? 'Referencia por servicio (ver por unidad)' : undefined,
      tone: s.exceedsReference ? 'alert' : s.reference !== null ? 'ok' : 'neutral',
    },
    ...(s.utilizationRatio !== null ? [{ label: 'Razón de utilización', value: String(s.utilizationRatio), hint: 'días dispositivo / días paciente', tone: 'neutral' as const }] : []),
  ];
  const toneClass = (t?: 'alert' | 'ok' | 'neutral') => (t === 'alert' ? 'text-red-600' : t === 'ok' ? 'text-green-600' : 'text-slate-800');
  const missingCols = !s.numeratorFound || !s.denominatorFound;
  const formatLabel = s.format === 'aggregated' ? 'Agregado (unidad × período)' : 'Línea por caso';

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <header className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">🧫 Vigilancia epidemiológica</h3>
            <p className="mt-0.5 text-sm text-slate-400">
              {auditName ? `${auditName}: ` : ''}tasa <strong>{s.rateName}</strong> = casos / días de exposición × {s.factor} ({s.unitLabel}).
            </p>
            {formula && <p className="mt-1 text-xs text-slate-400">🧮 {formula}</p>}
            <p className="mt-1 text-xs text-slate-400">📥 Formato detectado: <strong>{formatLabel}</strong></p>
          </div>
          {/* Selector de tipo de servicio (fija la referencia). */}
          {s.services.length > 0 && (
            <div className="shrink-0">
              <label htmlFor="svc" className="block text-xs font-semibold text-slate-500">Tipo de servicio (referencia)</label>
              <select
                id="svc"
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-nex-500 focus:outline-none focus:ring-2 focus:ring-nex-200"
              >
                <option value={AUTO}>Automático (por unidad)</option>
                {s.services.map((sv) => (
                  <option key={sv.service} value={sv.service}>
                    {sv.label} · ref {sv.reference}
                  </option>
                ))}
              </select>
            </div>
          )}
        </header>

        {missingCols ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ⚠️ No se detectaron las columnas del {s.numeratorFound ? '' : 'numerador (casos)'}
            {!s.numeratorFound && !s.denominatorFound ? ' ni del ' : ''}
            {s.denominatorFound ? '' : 'denominador (días)'}. Revisa que el Excel tenga esas columnas o ajústalas en «Revisar columnas».
          </p>
        ) : s.hasUnresolvedService ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ⚠️ No se identificó el tipo de servicio de una o más unidades, por lo que no se asume una referencia única. Selecciona el
            <strong> Tipo de servicio</strong> arriba para aplicar la referencia correspondiente.
          </p>
        ) : s.exceedsReference ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            🚨 Alerta: la tasa global ({s.overallRate} {s.unitLabel}) supera la referencia de {s.reference}.
          </p>
        ) : s.reference !== null && s.overallRate !== null ? (
          <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            ✓ La tasa global ({s.overallRate} {s.unitLabel}) está en o bajo la referencia de {s.reference}.
          </p>
        ) : s.referenceMode === 'per_unit' ? (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            ℹ️ Servicios mixtos: la referencia se aplica <strong>por servicio</strong>. Revisa las alertas por unidad más abajo.
          </p>
        ) : null}

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

      {s.byUnit.length > 0 && (
        <section className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">🏥 Resultado por unidad</h3>
          <RateTable points={s.byUnit} firstHeader="Unidad" showService={s.services.length > 0} />
        </section>
      )}

      {s.hasDate && s.byPeriod.length > 0 && (
        <section className="card p-5">
          <h3 className="mb-1 flex items-center gap-2 text-base font-bold text-slate-800">🗓️ Resultado por período ({s.granularityLabel})</h3>
          <p className="mb-3 text-xs text-slate-400">Evolución y comparación temporal de la tasa.</p>
          <RateTable points={s.byPeriod} firstHeader="Período" showService={false} />
        </section>
      )}

      <ExecutiveSummary analysis={analysis} fileName={fileName} onEdit={onEdit} />
      <SignatureBlock />
    </div>
  );
}
