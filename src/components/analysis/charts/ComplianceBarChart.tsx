import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ComplianceGroup } from '../../../types';
import { PALETTE, complianceHex } from '../../../utils/palette';

interface ComplianceBarChartProps {
  groups: ComplianceGroup[];
  goal: number;
  /** 'horizontal' = barras horizontales (categorías largas); 'vertical' = barras verticales. */
  orientation?: 'horizontal' | 'vertical';
}

interface Datum {
  name: string;
  percent: number;
  cumple: number;
  noCumple: number;
  aplicables: number;
}

function TooltipContent({ active, payload }: { active?: boolean; payload?: { payload: Datum }[] }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-slate-700">{d.name}</p>
      <p className="mt-0.5 text-slate-500">
        Cumplimiento: <span className="font-bold text-slate-700">{d.percent}%</span>
      </p>
      <p className="text-slate-400">
        {d.cumple} de {d.aplicables} casos aplicables
      </p>
    </div>
  );
}

/** Gráfico de barras de cumplimiento por categoría, con línea de meta y color por estado. */
export default function ComplianceBarChart({ groups, goal, orientation = 'horizontal' }: ComplianceBarChartProps) {
  const data: Datum[] = groups.map((g) => ({ name: g.label, percent: g.percent, cumple: g.cumple, noCumple: g.noCumple, aplicables: g.aplicables }));

  if (orientation === 'horizontal') {
    const height = Math.max(150, data.length * 42 + 30);
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 40, top: 4, bottom: 4 }}>
          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: PALETTE.muted }} axisLine={{ stroke: PALETTE.gray }} tickLine={false} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: PALETTE.ink }} axisLine={false} tickLine={false} />
          <Tooltip content={<TooltipContent />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
          <ReferenceLine x={goal} stroke={PALETTE.blue} strokeDasharray="4 4" label={{ value: `Meta ${goal}%`, position: 'top', fontSize: 10, fill: PALETTE.blue }} />
          <Bar dataKey="percent" radius={[0, 5, 5, 0]} barSize={20} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={complianceHex(d.percent, goal)} />
            ))}
            <LabelList dataKey="percent" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fill: PALETTE.ink, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ left: 4, right: 8, top: 24, bottom: 4 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: PALETTE.ink }} interval={0} axisLine={{ stroke: PALETTE.gray }} tickLine={false} />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: PALETTE.muted }} axisLine={false} tickLine={false} />
        <Tooltip content={<TooltipContent />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
        <ReferenceLine y={goal} stroke={PALETTE.blue} strokeDasharray="4 4" label={{ value: `Meta ${goal}%`, position: 'right', fontSize: 10, fill: PALETTE.blue }} />
        <Bar dataKey="percent" radius={[5, 5, 0, 0]} barSize={56} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={complianceHex(d.percent, goal)} />
          ))}
          <LabelList dataKey="percent" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fill: PALETTE.ink, fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
