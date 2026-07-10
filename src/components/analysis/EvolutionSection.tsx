import { CartesianGrid, Dot, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { EvolutionPoint } from '../../types';
import { PALETTE, complianceHex } from '../../utils/palette';

interface EvolutionSectionProps {
  points: EvolutionPoint[];
  goal: number;
  analysisTypeLabelText: string;
}

function TooltipContent({ active, payload, goal }: { active?: boolean; payload?: { payload: EvolutionPoint }[]; goal: number }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-slate-700">{d.label}</p>
      <p className="mt-0.5 text-slate-500">
        Cumplimiento: <span className="font-bold" style={{ color: complianceHex(d.percent, goal) }}>{d.percent}%</span>
      </p>
      <p className="text-slate-400">{d.cumple} de {d.total} casos aplicables</p>
    </div>
  );
}

/**
 * Evolución del cumplimiento a lo largo de los períodos (línea + tabla).
 * No filtra la base: segmenta el análisis global en el tiempo.
 */
export default function EvolutionSection({ points, goal, analysisTypeLabelText }: EvolutionSectionProps) {
  const first = points[0];
  const last = points[points.length - 1];
  const delta = points.length >= 2 ? Number((last.percent - first.percent).toFixed(1)) : null;

  return (
    <section className="card p-5">
      <header className="mb-4">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">📈 Evolución del cumplimiento</h3>
        <p className="mt-0.5 text-sm text-slate-400">
          {analysisTypeLabelText} · {points.length} período(s). El análisis global se mantiene; aquí se muestra su evolución en el tiempo.
        </p>
      </header>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={points} margin={{ left: 4, right: 16, top: 24, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.gray} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: PALETTE.ink }} interval={0} axisLine={{ stroke: PALETTE.gray }} tickLine={false} />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: PALETTE.muted }} axisLine={false} tickLine={false} />
          <Tooltip content={<TooltipContent goal={goal} />} cursor={{ stroke: PALETTE.gray }} />
          <ReferenceLine y={goal} stroke={PALETTE.blue} strokeDasharray="4 4" label={{ value: `Meta ${goal}%`, position: 'right', fontSize: 10, fill: PALETTE.blue }} />
          <Line
            type="monotone"
            dataKey="percent"
            stroke={PALETTE.blue}
            strokeWidth={2}
            isAnimationActive={false}
            dot={(props) => {
              const { cx, cy, payload, index } = props as { cx: number; cy: number; payload: EvolutionPoint; index: number };
              return <Dot key={index} cx={cx} cy={cy} r={5} fill={complianceHex(payload.percent, goal)} stroke="#fff" strokeWidth={1.5} />;
            }}
          />
        </LineChart>
      </ResponsiveContainer>

      {delta !== null && (
        <p className="mt-3 rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
          Variación entre <strong>{first.label}</strong> y <strong>{last.label}</strong>:{' '}
          <span className={delta >= 0 ? 'font-bold text-green-600' : 'font-bold text-red-600'}>
            {delta >= 0 ? '▲ +' : '▼ '}{delta} pp
          </span>
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="py-2 pr-3">Período</th>
              <th className="py-2 pr-3 text-right">Cumple</th>
              <th className="py-2 pr-3 text-right">Aplicables</th>
              <th className="py-2 pr-3 text-right">Cumplimiento</th>
              <th className="py-2 text-right">Meta</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.key} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-3 font-medium text-slate-700">{p.label}</td>
                <td className="py-2 pr-3 text-right text-slate-600">{p.cumple}</td>
                <td className="py-2 pr-3 text-right text-slate-600">{p.total}</td>
                <td className="py-2 pr-3 text-right font-bold" style={{ color: complianceHex(p.percent, goal) }}>
                  {p.percent}%
                </td>
                <td className="py-2 text-right">
                  <span className={p.meetsGoal ? 'text-green-600' : 'text-red-600'}>{p.meetsGoal ? '✓' : '✗'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
