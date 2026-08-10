import { useMemo, useState } from 'react';
import { CartesianGrid, Dot, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ReportType } from '../../types';
import { PALETTE, complianceHex } from '../../utils/palette';
import { buildComparative, type ComparativePeriod } from '../../utils/comparative';

interface Props {
  initialPeriods: ComparativePeriod[];
  reportType: ReportType;
  onReset: () => void;
  onAddMore: () => void;
}

function ChartTooltip({ active, payload, goal }: { active?: boolean; payload?: { payload: { label: string; percent: number } }[]; goal: number }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-slate-700">{d.label}</p>
      <p className="mt-0.5 text-slate-500">
        Cumplimiento: <span className="font-bold" style={{ color: complianceHex(d.percent, goal) }}>{d.percent}%</span>
      </p>
    </div>
  );
}

/**
 * Comparativo mensual: cada archivo cargado es un mes de la misma auditoría.
 * Muestra la evolución del cumplimiento global y una matriz indicador × mes.
 */
export default function ComparativeView({ initialPeriods, reportType, onReset, onAddMore }: Props) {
  const [periods, setPeriods] = useState<ComparativePeriod[]>(initialPeriods);
  const cmp = useMemo(() => buildComparative(periods, reportType), [periods, reportType]);

  const rename = (id: string, label: string) => setPeriods((ps) => ps.map((p) => (p.id === id ? { ...p, label } : p)));
  const remove = (id: string) => setPeriods((ps) => ps.filter((p) => p.id !== id));
  const move = (id: string, dir: -1 | 1) =>
    setPeriods((ps) => {
      const i = ps.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ps.length) return ps;
      const n = [...ps];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const chartData = cmp.periods.map((p, i) => ({ label: p.label, percent: cmp.globals[i] }));

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-black text-slate-800">Comparativo mensual</h2>
        <p className="mt-1 text-slate-500">
          {cmp.programName} · {cmp.periods.length} período(s) · meta {cmp.goal}%
        </p>
      </div>

      {/* Tira de KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Períodos" value={String(cmp.periods.length)} hint="meses comparados" />
        <Kpi label="Promedio" value={`${cmp.avg}%`} hint={`meta ${cmp.goal}%`} color={complianceHex(cmp.avg, cmp.goal)} />
        <Kpi label="Mejor mes" value={cmp.best ? `${cmp.best.percent}%` : '—'} hint={cmp.best?.label ?? ''} color={PALETTE.green} />
        <Kpi label="Peor mes" value={cmp.worst ? `${cmp.worst.percent}%` : '—'} hint={cmp.worst?.label ?? ''} color={PALETTE.red} />
      </div>

      {/* Evolución del cumplimiento global */}
      <section className="card p-5">
        <header className="mb-4">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">📈 Evolución del cumplimiento global</h3>
          <p className="mt-0.5 text-sm text-slate-400">Un punto por mes cargado. La línea punteada marca la meta institucional.</p>
        </header>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ left: 4, right: 16, top: 24, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.gray} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: PALETTE.ink }} interval={0} axisLine={{ stroke: PALETTE.gray }} tickLine={false} />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: PALETTE.muted }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip goal={cmp.goal} />} cursor={{ stroke: PALETTE.gray }} />
            <ReferenceLine y={cmp.goal} stroke={PALETTE.blue} strokeDasharray="4 4" label={{ value: `Meta ${cmp.goal}%`, position: 'right', fontSize: 10, fill: PALETTE.blue }} />
            <Line
              type="monotone"
              dataKey="percent"
              stroke={PALETTE.blue}
              strokeWidth={2}
              isAnimationActive={false}
              dot={(props) => {
                const { cx, cy, payload, index } = props as { cx: number; cy: number; payload: { percent: number }; index: number };
                return <Dot key={index} cx={cx} cy={cy} r={5} fill={complianceHex(payload.percent, cmp.goal)} stroke="#fff" strokeWidth={1.5} />;
              }}
            />
          </LineChart>
        </ResponsiveContainer>

        {cmp.delta !== null && cmp.periods.length >= 2 && (
          <p className="mt-3 rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
            Variación entre <strong>{cmp.periods[0].label}</strong> y <strong>{cmp.periods[cmp.periods.length - 1].label}</strong>:{' '}
            <span className={cmp.delta >= 0 ? 'font-bold text-green-600' : 'font-bold text-red-600'}>
              {cmp.delta >= 0 ? '▲ +' : '▼ '}{cmp.delta} pp
            </span>
          </p>
        )}
      </section>

      {/* Comparativo por indicador */}
      {cmp.indicators.length > 0 && (
        <section className="card p-5">
          <header className="mb-4">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">📊 Cumplimiento por indicador y mes</h3>
            <p className="mt-0.5 text-sm text-slate-400">Cada celda es el % de cumplimiento del indicador ese mes. El color indica el estado frente a la meta.</p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 320 + cmp.periods.length * 90 }}>
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3">Indicador</th>
                  {cmp.periods.map((p) => (
                    <th key={p.id} className="py-2 px-2 text-center">{p.label}</th>
                  ))}
                  <th className="py-2 pl-2 text-center">Tend.</th>
                </tr>
              </thead>
              <tbody>
                {cmp.indicators.map((row) => {
                  const present = row.values.filter((v): v is number => v !== null);
                  const first = present[0];
                  const last = present[present.length - 1];
                  const d = present.length >= 2 ? Number((last - first).toFixed(1)) : null;
                  return (
                    <tr key={row.label} className="border-b border-slate-100 last:border-0 align-top">
                      <td className="py-2.5 pr-3 text-slate-700">
                        {row.label}
                        {row.kind === 'complementario' && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-400">compl.</span>}
                      </td>
                      {row.values.map((v, i) => (
                        <td key={i} className="py-2.5 px-2 text-center font-bold" style={{ color: v === null ? PALETTE.muted : complianceHex(v, cmp.goal) }}>
                          {v === null ? '—' : `${v}%`}
                        </td>
                      ))}
                      <td className="py-2.5 pl-2 text-center text-xs font-bold">
                        {d === null ? <span className="text-slate-300">—</span> : <span className={d >= 0 ? 'text-green-600' : 'text-red-600'}>{d >= 0 ? `▲+${d}` : `▼${d}`}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Detalle de meses: renombrar, ordenar, quitar */}
      <section className="card p-5">
        <header className="mb-3">
          <h3 className="text-base font-bold text-slate-800">🗂️ Meses cargados</h3>
          <p className="mt-0.5 text-sm text-slate-400">Renombra cada mes, ordénalos o quita alguno. El comparativo se actualiza al instante.</p>
        </header>
        <div className="space-y-2">
          {cmp.periods.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5">
              <div className="flex shrink-0 flex-col">
                <button type="button" onClick={() => move(p.id, -1)} disabled={i === 0} className="px-1 text-xs text-slate-400 hover:text-nex-700 disabled:opacity-30" aria-label="Subir">▲</button>
                <button type="button" onClick={() => move(p.id, 1)} disabled={i === cmp.periods.length - 1} className="px-1 text-xs text-slate-400 hover:text-nex-700 disabled:opacity-30" aria-label="Bajar">▼</button>
              </div>
              <input
                value={p.label}
                onChange={(e) => rename(p.id, e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-nex-500 focus:outline-none focus:ring-2 focus:ring-nex-200"
                aria-label={`Nombre del mes ${i + 1}`}
              />
              <span className="hidden shrink-0 text-xs text-slate-400 sm:inline" title={p.fileName}>📄 {p.fileName}</span>
              <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold" style={{ color: complianceHex(cmp.globals[i], cmp.goal) }}>{cmp.globals[i]}%</span>
              <button type="button" onClick={() => remove(p.id)} disabled={cmp.periods.length <= 1} className="shrink-0 text-xs font-semibold text-slate-400 hover:text-red-600 disabled:opacity-30">Quitar</button>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onAddMore} className="btn-ghost">↩ Volver a cargar archivos</button>
        <button type="button" onClick={onReset} className="text-sm font-semibold text-slate-500 hover:text-nex-700">Empezar de nuevo</button>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black" style={{ color: color ?? PALETTE.ink }}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
