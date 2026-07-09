import type { AnalysisResult } from '../../types';

/** Tarjetas KPI principales del análisis. */
export default function KpiCards({ a }: { a: AnalysisResult }) {
  const g = a.global;
  const goalColor = g.meetsGoal ? 'text-green-600' : 'text-amber-600';

  const cards: { label: string; value: string; hint?: string; color?: string }[] = [
    { label: 'Total de registros', value: String(a.totalRecords), hint: `${g.aplicables} aplicables` },
    { label: 'Cumplimiento global', value: `${g.percent}%`, hint: `Meta ${a.config.goal}%`, color: goalColor },
    { label: 'Cumple', value: String(g.cumple), color: 'text-green-600' },
    { label: 'No cumple', value: String(g.noCumple), color: 'text-red-500' },
    { label: 'No aplica', value: String(g.noAplica), color: 'text-slate-400' },
    { label: 'Indicadores críticos', value: String(a.criticalIndicators.length), hint: `${a.highlightedIndicators.length} sobre la meta`, color: a.criticalIndicators.length ? 'text-red-500' : 'text-green-600' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="card p-4">
          <p className="text-xs font-medium text-slate-500">{c.label}</p>
          <p className={`mt-1 text-2xl font-extrabold ${c.color ?? 'text-slate-800'}`}>{c.value}</p>
          {c.hint && <p className="mt-0.5 text-xs text-slate-400">{c.hint}</p>}
        </div>
      ))}
    </div>
  );
}
