import type { ParsedWorkbook } from '../../types';
import { OTROS_REPORT_TYPES, type OtrosColType, type OtrosConfig, type OtrosMetric } from '../../utils/otros/types';

interface Props {
  workbook: ParsedWorkbook;
  config: OtrosConfig;
  onChange: (patch: Partial<OtrosConfig>) => void;
}

const METRICS: { value: OtrosMetric; label: string }[] = [
  { value: 'conteo', label: 'Conteo de casos' },
  { value: 'promedio', label: 'Promedio de una columna' },
  { value: 'suma', label: 'Suma de una columna' },
  { value: 'cumplimiento', label: 'Cumplimiento %' },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700">{label}</label>
      {hint && <p className="mb-1 text-xs text-slate-400">{hint}</p>}
      <div className="mt-1">{children}</div>
    </div>
  );
}

const selCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-nex-500 focus:outline-none focus:ring-2 focus:ring-nex-200';

/** Multiselección de columnas mediante casillas. */
function MultiCols({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  if (options.length === 0) return <p className="text-xs text-amber-600">No hay columnas de este tipo. Ajusta el mapeo.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on ? 'border-nex-500 bg-nex-50 text-nex-700' : 'border-slate-200 bg-white text-slate-500 hover:border-nex-300'}`}>
            {on ? '✓ ' : ''}{o}
          </button>
        );
      })}
    </div>
  );
}

/** Asistente adaptable del módulo «Otros informes» (P1–P7). */
export default function OtrosWizard({ workbook, config, onChange }: Props) {
  const byType = (t: OtrosColType) => Object.keys(config.mapping).filter((h) => config.mapping[h] === t);
  const resultCols = byType('resultado');
  const numCols = byType('numerica');
  const dateCols = byType('fecha');
  const dimCols = [...byType('unidad'), ...byType('categoria')];
  const t = config.reportType;
  const needsValueCol = (t === 'evolucion' || t === 'comparacion') && (config.metric === 'promedio' || config.metric === 'suma');
  const needsComplianceMetric = (t === 'evolucion' || t === 'comparacion') && config.metric === 'cumplimiento';

  return (
    <div className="space-y-6">
      {/* P1 tipo */}
      <Field label="1 · ¿Qué tipo de informe quieres generar?">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {OTROS_REPORT_TYPES.map((rt) => (
            <button key={rt.value} type="button" onClick={() => onChange({ reportType: rt.value })}
              className={`rounded-2xl border p-3 text-left transition ${t === rt.value ? 'border-nex-500 bg-nex-50 ring-2 ring-nex-200' : 'border-slate-200 bg-white hover:border-nex-300'}`}>
              <p className="text-sm font-bold text-slate-800">{rt.icon} {rt.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{rt.description}</p>
            </button>
          ))}
        </div>
      </Field>

      {/* P2 columnas principales */}
      <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">2 · Variables principales</p>
        {t === 'cumplimiento' && (
          <Field label="Columnas de resultado (Cumple/No cumple)"><MultiCols options={resultCols} value={config.complianceCols} onChange={(v) => onChange({ complianceCols: v })} /></Field>
        )}
        {t === 'tasa' && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Numerador"><select className={selCls} value={config.numeratorCol ?? ''} onChange={(e) => onChange({ numeratorCol: e.target.value || null })}><option value="">—</option>{numCols.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
            <Field label="Denominador"><select className={selCls} value={config.denominatorCol ?? ''} onChange={(e) => onChange({ denominatorCol: e.target.value || null })}><option value="">—</option>{numCols.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
            <Field label="Factor"><input type="number" className={selCls} value={config.factor} onChange={(e) => onChange({ factor: Number(e.target.value) })} /></Field>
          </div>
        )}
        {t === 'frecuencia' && (
          <Field label="Categoría o unidad a contar"><select className={selCls} value={config.dimensionCol ?? ''} onChange={(e) => onChange({ dimensionCol: e.target.value || null })}><option value="">—</option>{dimCols.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
        )}
        {(t === 'evolucion' || t === 'comparacion') && (
          <div className="grid gap-3 sm:grid-cols-2">
            {t === 'evolucion' && <Field label="Columna de fecha"><select className={selCls} value={config.dateCol ?? ''} onChange={(e) => onChange({ dateCol: e.target.value || null })}><option value="">—</option>{dateCols.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>}
            {t === 'comparacion' && <Field label="Unidad o grupo a comparar"><select className={selCls} value={config.dimensionCol ?? ''} onChange={(e) => onChange({ dimensionCol: e.target.value || null })}><option value="">—</option>{dimCols.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>}
            <Field label="Métrica"><select className={selCls} value={config.metric} onChange={(e) => onChange({ metric: e.target.value as OtrosMetric })}>{METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></Field>
            {needsValueCol && <Field label="Columna numérica de la métrica"><select className={selCls} value={config.valueCol ?? ''} onChange={(e) => onChange({ valueCol: e.target.value || null })}><option value="">—</option>{numCols.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>}
            {needsComplianceMetric && <Field label="Columnas de resultado"><MultiCols options={resultCols} value={config.complianceCols} onChange={(v) => onChange({ complianceCols: v })} /></Field>}
            {t === 'evolucion' && <Field label="Granularidad"><select className={selCls} value={config.granularity} onChange={(e) => onChange({ granularity: e.target.value as OtrosConfig['granularity'] })}><option value="mensual">Mensual</option><option value="trimestral">Trimestral</option><option value="semestral">Semestral</option><option value="anual">Anual</option></select></Field>}
          </div>
        )}
        {t === 'descriptivo' && (
          <Field label="Variables a caracterizar (prevalencia)"><MultiCols options={[...resultCols, ...dimCols]} value={config.descriptiveCols} onChange={(v) => onChange({ descriptiveCols: v })} /></Field>
        )}
      </div>

      {/* P3 complementarias */}
      <Field label="3 · Variables complementarias" hint="Se informan aparte; no alteran el resultado oficial.">
        <MultiCols options={resultCols.filter((c) => !config.complianceCols.includes(c))} value={config.complementaryCols} onChange={(v) => onChange({ complementaryCols: v })} />
      </Field>

      {/* P4 meta */}
      <Field label="4 · Meta o referencia (opcional)" hint="% para cumplimiento; valor numérico para tasa/frecuencia.">
        <input type="number" className={`${selCls} max-w-[180px]`} value={config.goal ?? ''} placeholder="sin meta" onChange={(e) => onChange({ goal: e.target.value === '' ? null : Number(e.target.value) })} />
      </Field>

      {/* P5 desgloses */}
      <Field label="5 · Desgloses requeridos" hint="La métrica se calculará también por estas categorías.">
        <MultiCols options={dimCols} value={config.breakdowns} onChange={(v) => onChange({ breakdowns: v })} />
      </Field>

      {/* P6 criterios */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="6 · Criterios de inclusión"><textarea className={selCls} rows={2} value={config.inclusion} onChange={(e) => onChange({ inclusion: e.target.value })} /></Field>
        <Field label="Criterios de exclusión"><textarea className={selCls} rows={2} value={config.exclusion} onChange={(e) => onChange({ exclusion: e.target.value })} /></Field>
        <Field label="Manejo de N/A"><select className={selCls} value={config.naMode} onChange={(e) => onChange({ naMode: e.target.value as OtrosConfig['naMode'] })}><option value="excluir">Excluir del denominador</option><option value="no_cumple">Contar como No cumple</option></select></Field>
      </div>

      {/* P7 identidad */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="7 · Nombre del informe"><input className={selCls} value={config.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="p. ej. Adherencia a checklist quirúrgico" /></Field>
        <Field label="Objetivo"><input className={selCls} value={config.objective} onChange={(e) => onChange({ objective: e.target.value })} placeholder="¿Qué busca medir este informe?" /></Field>
      </div>
      <p className="text-xs text-slate-400">Archivo: {workbook.fileName} · {workbook.rows.length} filas</p>
    </div>
  );
}
