import type { ComplianceGroup } from '../../types';

interface ComplianceTableProps {
  groups: ComplianceGroup[];
  firstHeader: string;
  goal: number;
  showStatus?: boolean;
}

function barColor(percent: number, goal: number): string {
  if (percent >= goal) return '#16a34a';
  if (percent >= goal - 10) return '#d97706';
  return '#dc2626';
}

/** Tabla de cumplimiento por categoría con barra de progreso y estado. */
export default function ComplianceTable({ groups, firstHeader, goal, showStatus = true }: ComplianceTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-3 font-semibold">{firstHeader}</th>
            <th className="py-2 px-3 text-center font-semibold">Cumple</th>
            <th className="py-2 px-3 text-center font-semibold">No cumple</th>
            <th className="py-2 px-3 text-center font-semibold">N/A</th>
            <th className="py-2 px-3 font-semibold">Cumplimiento</th>
            {showStatus && <th className="py-2 pl-3 text-center font-semibold">Estado</th>}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const color = barColor(g.percent, goal);
            return (
              <tr key={g.label} className="border-b border-slate-100 last:border-0">
                <td className="py-2.5 pr-3 font-medium text-slate-700">{g.label}</td>
                <td className="py-2.5 px-3 text-center text-slate-600">{g.cumple}</td>
                <td className="py-2.5 px-3 text-center text-slate-600">{g.noCumple}</td>
                <td className="py-2.5 px-3 text-center text-slate-400">{g.noAplica}</td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 flex-1 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full" style={{ width: `${g.percent}%`, backgroundColor: color }} />
                    </div>
                    <span className="w-12 text-right font-semibold" style={{ color }}>
                      {g.percent}%
                    </span>
                  </div>
                </td>
                {showStatus && (
                  <td className="py-2.5 pl-3 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        g.meetsGoal ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {g.meetsGoal ? 'Cumple' : 'Bajo meta'}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
