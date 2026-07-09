import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { GlobalCompliance } from '../../../types';
import { PALETTE } from '../../../utils/palette';

/** Gráfico donut con la distribución de resultados: cumple / no cumple / no aplica. */
export default function DistributionDonut({ global }: { global: GlobalCompliance }) {
  const total = global.cumple + global.noCumple + global.noAplica;
  const data = [
    { name: 'Cumple', value: global.cumple, color: PALETTE.green },
    { name: 'No cumple', value: global.noCumple, color: PALETTE.red },
    { name: 'No aplica', value: global.noAplica, color: PALETTE.gray },
  ].filter((d) => d.value > 0);

  if (total === 0) {
    return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-400">No hay resultados para graficar.</p>;
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={64} outerRadius={92} paddingAngle={2} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} stroke={PALETTE.white} strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [`${value} (${Math.round((value / total) * 100)}%)`, name]}
            contentStyle={{ borderRadius: 8, border: `1px solid ${PALETTE.line}`, fontSize: 12 }}
          />
          <Legend verticalAlign="bottom" height={28} iconType="circle" formatter={(v) => <span style={{ fontSize: 12, color: PALETTE.ink }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
      {/* Centro del donut: total de casos */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" style={{ top: '-14px' }}>
        <span className="text-2xl font-extrabold text-slate-800">{total}</span>
        <span className="text-xs text-slate-400">registros</span>
      </div>
    </div>
  );
}
