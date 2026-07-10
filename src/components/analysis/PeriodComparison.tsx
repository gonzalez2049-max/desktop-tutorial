import { useMemo, useState } from 'react';
import type { ParsedWorkbook, ReportConfig } from '../../types';
import { analyze, filterWorkbookByPeriod } from '../../utils/analysis';
import { granularityFor } from '../../config/options';
import { complianceHex } from '../../utils/palette';

interface PeriodComparisonProps {
  workbook: ParsedWorkbook;
  config: ReportConfig;
  periods: { key: string; label: string }[];
}

/** Formatea un porcentaje o un guion cuando no hay dato. */
function fmt(v: number | null): string {
  return v === null ? '—' : `${v}%`;
}

/** Delta con signo y color; null si falta alguno de los dos valores. */
function DeltaCell({ a, b, goal }: { a: number | null; b: number | null; goal: number }) {
  if (a === null || b === null) return <span className="text-slate-300">—</span>;
  const d = Number((b - a).toFixed(1));
  const color = d > 0 ? 'text-green-600' : d < 0 ? 'text-red-600' : 'text-slate-500';
  const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '=';
  void goal;
  return (
    <span className={`font-bold ${color}`}>
      {arrow} {d > 0 ? '+' : ''}{d} pp
    </span>
  );
}

/**
 * Comparación de dos períodos elegidos, lado a lado. Reutiliza el motor de
 * análisis completo sobre cada período (misma lógica de cumplimiento) y muestra
 * las métricas clave con su variación (Δ).
 */
export default function PeriodComparison({ workbook, config, periods }: PeriodComparisonProps) {
  const gran = granularityFor(config.analysisType);
  const [keyA, setKeyA] = useState<string>(periods[0]?.key ?? '');
  const [keyB, setKeyB] = useState<string>(periods[periods.length - 1]?.key ?? '');

  const anA = useMemo(() => analyze(filterWorkbookByPeriod(workbook, keyA, gran), config), [workbook, config, keyA, gran]);
  const anB = useMemo(() => analyze(filterWorkbookByPeriod(workbook, keyB, gran), config), [workbook, config, keyB, gran]);

  const labelA = periods.find((p) => p.key === keyA)?.label ?? keyA;
  const labelB = periods.find((p) => p.key === keyB)?.label ?? keyB;
  const goal = config.goal;

  // Indicadores presentes en cualquiera de los dos períodos (unión).
  const indicators = useMemo(() => {
    const names = new Set<string>();
    anA.complianceByIndicator.forEach((g) => names.add(g.label));
    anB.complianceByIndicator.forEach((g) => names.add(g.label));
    return Array.from(names).sort((x, y) => x.localeCompare(y, 'es'));
  }, [anA, anB]);

  const indPct = (an: typeof anA, label: string): number | null => {
    const g = an.complianceByIndicator.find((i) => i.label === label);
    return g && g.aplicables > 0 ? g.percent : null;
  };

  const globalA = anA.global.aplicables > 0 ? anA.global.percent : null;
  const globalB = anB.global.aplicables > 0 ? anB.global.percent : null;
  const lppA = anA.characterization.lppPrevalence;
  const lppB = anB.characterization.lppPrevalence;

  const rows: { label: string; a: number | null; b: number | null; strong?: boolean }[] = [
    { label: 'Cumplimiento global', a: globalA, b: globalB, strong: true },
    ...indicators.map((name) => ({ label: name, a: indPct(anA, name), b: indPct(anB, name) })),
  ];
  if (lppA !== null || lppB !== null) {
    rows.push({ label: 'Prevalencia de LPP', a: lppA, b: lppB, strong: true });
  }

  const selectCls = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-nex-500 focus:outline-none focus:ring-2 focus:ring-nex-200';

  return (
    <section className="card p-5">
      <header className="mb-4">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">⚖️ Comparación entre períodos</h3>
        <p className="mt-0.5 text-sm text-slate-400">Elige dos períodos para contrastar las métricas clave y su variación (Δ, en puntos porcentuales).</p>
      </header>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
          Período A
          <select value={keyA} onChange={(e) => setKeyA(e.target.value)} className={selectCls}>
            {periods.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
          Período B
          <select value={keyB} onChange={(e) => setKeyB(e.target.value)} className={selectCls}>
            {periods.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="py-2 pr-3">Métrica</th>
              <th className="py-2 pr-3 text-right">{labelA}</th>
              <th className="py-2 pr-3 text-right">{labelB}</th>
              <th className="py-2 text-right">Δ (B − A)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-slate-100 last:border-0">
                <td className={`py-2 pr-3 ${r.strong ? 'font-semibold text-slate-800' : 'font-medium text-slate-600'}`}>{r.label}</td>
                <td className="py-2 pr-3 text-right font-bold" style={{ color: r.a === null ? undefined : complianceHex(r.a, goal) }}>
                  {fmt(r.a)}
                </td>
                <td className="py-2 pr-3 text-right font-bold" style={{ color: r.b === null ? undefined : complianceHex(r.b, goal) }}>
                  {fmt(r.b)}
                </td>
                <td className="py-2 text-right">
                  <DeltaCell a={r.a} b={r.b} goal={goal} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Cada período se analiza con la misma lógica de cumplimiento (incluido el filtro de riesgo NT 234 cuando aplica).
        La prevalencia de LPP no se compara contra la meta.
      </p>
    </section>
  );
}
